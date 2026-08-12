import { lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { reportFileName, writeReportFile } from './report-document.mjs';

const legacySnapshotFileNames = new Set([
  'turns.json',
  'changes.json',
  'metadata.json',
  'judgment.json',
  'generated-files.json',
  'files',
]);
const legacyTurnEntryPattern = /^turn-\d+$/u;

export async function writeScenarioSnapshot({
  scenarioDir,
  snapshotDirName,
  report,
}) {
  validateSnapshotDirectoryName(snapshotDirName);

  const snapshotDir = join(scenarioDir, snapshotDirName);
  const snapshotPath = join(snapshotDir, reportFileName);
  const snapshot = structuredClone(report);

  snapshot.revision = 1;
  snapshot.stage = 'complete';
  snapshot.inspect = {};

  await ensureSnapshotDirectory(snapshotDir);
  const legacyEntries = await findLegacySnapshotEntries(snapshotDir);
  await writeReportFile(snapshotPath, snapshot);
  await removeLegacySnapshotEntries(snapshotDir, legacyEntries);

  return snapshotPath;
}

export function validateSnapshotDirectoryName(value, label = 'snapshotDirName') {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value === '.'
    || value === '..'
    || value.includes('/')
    || value.includes('\\')
    || value.includes('\0')
  ) {
    throw new Error(`${label} must be a directory name, got ${JSON.stringify(value)}.`);
  }

  return value;
}

async function ensureSnapshotDirectory(snapshotDir) {
  let stats;

  try {
    stats = await lstat(snapshotDir);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }

    await mkdir(snapshotDir, { recursive: true });
    stats = await lstat(snapshotDir);
  }

  if (stats.isSymbolicLink()) {
    throw new Error(`Snapshot directory must not be a symbolic link: ${snapshotDir}`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Snapshot path must be a directory: ${snapshotDir}`);
  }
}

async function findLegacySnapshotEntries(snapshotDir) {
  const entries = await readdir(snapshotDir, { withFileTypes: true });
  const unknownEntries = entries.filter(
    (entry) => entry.name !== reportFileName && !isLegacySnapshotEntry(entry.name),
  );

  if (unknownEntries.length > 0) {
    const names = unknownEntries.map((entry) => entry.name).sort().join(', ');

    throw new Error(
      `Snapshot directory contains unknown entries; refusing to remove them: ${names}`,
    );
  }

  return entries
    .filter((entry) => isLegacySnapshotEntry(entry.name))
    .map((entry) => entry.name);
}

function isLegacySnapshotEntry(name) {
  return legacySnapshotFileNames.has(name) || legacyTurnEntryPattern.test(name);
}

async function removeLegacySnapshotEntries(snapshotDir, entries) {
  await Promise.all(entries.map(
    (entry) => rm(join(snapshotDir, entry), { recursive: true, force: true }),
  ));
}
