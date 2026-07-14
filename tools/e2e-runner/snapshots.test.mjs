import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildSnapshotTurns,
  turnSnapshotDirName,
  writeSnapshotTurns,
} from './snapshots.mjs';

test('turnSnapshotDirName uses stable numbered directories', () => {
  assert.equal(turnSnapshotDirName(0), 'turn-01');
  assert.equal(turnSnapshotDirName(11), 'turn-12');
});

test('buildSnapshotTurns adds per-turn snapshot directory names', () => {
  assert.deepEqual(buildSnapshotTurns([
    {
      source: 'prompt.md',
      prompt: 'Update docs.',
      generatedFiles: [{ path: 'README.md', content: '# Readme\n' }],
      notes: 'Updated README.',
    },
  ]), [
    {
      source: 'prompt.md',
      snapshotDir: 'turn-01',
      prompt: 'Update docs.',
      generatedFiles: [{ path: 'README.md', content: '# Readme\n' }],
      notes: 'Updated README.',
    },
  ]);
});

test('writeSnapshotTurns writes inspectable per-turn directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshots-'));

  await mkdir(join(root, 'turn-03/files'), { recursive: true });
  await writeFile(join(root, 'turn-03/files/stale.md'), 'stale\n');

  await writeSnapshotTurns(root, [
    {
      source: 'turns/01-request.md',
      prompt: '# Turn 1\n\nAsk first.',
      generatedFiles: [],
      notes: 'Asked for confirmation.',
    },
    {
      source: 'turns/02-confirm.md',
      prompt: '# Turn 2\n\nConfirmed.',
      generatedFiles: [{ path: 'docs/decision.md', content: '# Decision\n' }],
      notes: 'Recorded the decision.',
    },
  ]);

  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'turns.json'), 'utf8')).map((turn) => turn.snapshotDir),
    ['turn-01', 'turn-02'],
  );
  assert.equal(await readFile(join(root, 'turn-01/prompt.md'), 'utf8'), '# Turn 1\n\nAsk first.\n');
  assert.equal(await readFile(join(root, 'turn-01/notes.txt'), 'utf8'), 'Asked for confirmation.\n');
  assert.equal(
    await readFile(join(root, 'turn-02/files/docs/decision.md'), 'utf8'),
    '# Decision\n',
  );
  assert.equal(
    JSON.parse(await readFile(join(root, 'turn-02/turn.json'), 'utf8')).source,
    'turns/02-confirm.md',
  );
  assert.equal(await exists(join(root, 'turn-03')), false);
});

async function exists(path) {
  return Boolean(await stat(path).catch(() => null));
}
