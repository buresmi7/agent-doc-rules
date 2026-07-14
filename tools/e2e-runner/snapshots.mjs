import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function buildSnapshotTurns(turns) {
  return turns.map((turn, index) => ({
    source: turn.source,
    snapshotDir: turnSnapshotDirName(index),
    prompt: turn.prompt,
    generatedFiles: turn.generatedFiles,
    notes: turn.notes,
  }));
}

export function turnSnapshotDirName(index) {
  return `turn-${String(index + 1).padStart(2, '0')}`;
}

export async function writeGeneratedFileTree(root, files) {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  for (const file of files) {
    const target = join(root, file.path);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

export async function writeSnapshotTurns(snapshotDir, turns) {
  const snapshotTurns = buildSnapshotTurns(turns);

  await removeOldTurnDirs(snapshotDir);
  await writeFile(join(snapshotDir, 'turns.json'), `${JSON.stringify(snapshotTurns, null, 2)}\n`);

  for (const turn of snapshotTurns) {
    const turnDir = join(snapshotDir, turn.snapshotDir);

    await mkdir(turnDir, { recursive: true });
    await writeFile(join(turnDir, 'turn.json'), `${JSON.stringify(turn, null, 2)}\n`);
    await writeFile(join(turnDir, 'prompt.md'), `${turn.prompt.trim()}\n`);
    await writeFile(join(turnDir, 'notes.txt'), `${turn.notes.trim()}\n`);
    await writeFile(
      join(turnDir, 'generated-files.json'),
      `${JSON.stringify(turn.generatedFiles, null, 2)}\n`,
    );
    await writeGeneratedFileTree(join(turnDir, 'files'), turn.generatedFiles);
  }

  return snapshotTurns;
}

async function removeOldTurnDirs(snapshotDir) {
  const entries = await readdir(snapshotDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  });

  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^turn-\d+$/.test(entry.name))
    .map((entry) => rm(join(snapshotDir, entry.name), { recursive: true, force: true })));
}
