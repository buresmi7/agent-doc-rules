import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  applyReportEvaluation,
  createScenarioReport,
} from '../src/report-document.mjs';
import { writeScenarioSnapshot } from '../src/snapshots.mjs';

test('writeScenarioSnapshot writes one report.json and removes legacy entries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshots-'));
  const scenarioDir = join(root, 'scenario');
  const snapshotDir = join(scenarioDir, 'snapshot');
  const report = createScenarioReport({
    scenarioName: 'example',
    runner: 'codex',
    turns: [{
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Update docs.',
      criteria: [{
        id: 'request.docs',
        source: 'scenario.json#/turns/0/criteria/docs',
        content: 'Docs are updated.',
      }],
    }],
  });

  report.revision = 12;
  report.stage = 'snapshot';
  report.turns[0].status = 'completed';
  report.turns[0].response = 'Updated docs.';
  applyReportEvaluation(report, {
    pass: true,
    score: 1,
    failedCriteria: [],
    requiredFixes: [],
    notes: '',
  }, true);
  report.stage = 'snapshot';

  await mkdir(join(snapshotDir, 'turn-01/files'), { recursive: true });
  await mkdir(join(snapshotDir, 'files'), { recursive: true });
  await writeFile(join(snapshotDir, 'turn-01/files/stale.md'), 'stale\n');
  await writeFile(join(snapshotDir, 'files/stale.md'), 'stale\n');
  await writeFile(join(snapshotDir, 'turn-02'), 'stale\n');
  await writeFile(join(snapshotDir, 'turns.json'), '[]\n');
  await writeFile(join(snapshotDir, 'changes.json'), '[]\n');
  await writeFile(join(snapshotDir, 'metadata.json'), '{}\n');
  await writeFile(join(snapshotDir, 'judgment.json'), '{}\n');
  await writeFile(join(snapshotDir, 'generated-files.json'), '[]\n');

  const snapshotPath = await writeScenarioSnapshot({
    scenarioDir,
    snapshotDirName: 'snapshot',
    report,
  });
  const content = await readFile(snapshotPath, 'utf8');
  const snapshot = JSON.parse(content);

  assert.equal(snapshotPath, join(snapshotDir, 'report.json'));
  assert.deepEqual(await readdir(snapshotDir), ['report.json']);
  assert.equal(content.endsWith('\n'), true);
  assert.equal(snapshot.revision, 1);
  assert.equal(snapshot.stage, 'complete');
  assert.equal(snapshot.status, 'passed');
  assert.deepEqual(snapshot.warnings, []);
  assert.deepEqual(snapshot.inspect, {});
  assert.equal(snapshot.turns[0].response, 'Updated docs.');
  assert.equal(report.revision, 12);
  assert.equal(report.stage, 'snapshot');
});

test('writeScenarioSnapshot keeps legacy entries when the replacement cannot be written', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshot-failure-'));
  const scenarioDir = join(root, 'scenario');
  const snapshotDir = join(scenarioDir, 'snapshot');
  const report = createScenarioReport({ scenarioName: 'invalid-snapshot' });

  report.rawAgentEvents = [];
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(join(snapshotDir, 'turns.json'), '[]\n');

  await assert.rejects(
    () => writeScenarioSnapshot({
      scenarioDir,
      snapshotDirName: 'snapshot',
      report,
    }),
    /report contains unexpected field "rawAgentEvents"/,
  );

  assert.deepEqual(await readdir(snapshotDir), ['turns.json']);
});

test('writeScenarioSnapshot rejects a symlink without modifying its target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshot-symlink-'));
  const scenarioDir = join(root, 'scenario');
  const snapshotDir = join(scenarioDir, 'snapshot');
  const externalDir = join(root, 'external');
  const sentinelPath = join(externalDir, 'sentinel.txt');
  const report = createScenarioReport({ scenarioName: 'symlink-snapshot' });

  await mkdir(scenarioDir, { recursive: true });
  await mkdir(externalDir, { recursive: true });
  await writeFile(sentinelPath, 'keep me\n');
  await symlink(externalDir, snapshotDir, 'dir');

  await assert.rejects(
    () => writeScenarioSnapshot({
      scenarioDir,
      snapshotDirName: 'snapshot',
      report,
    }),
    /Snapshot directory must not be a symbolic link/,
  );

  assert.equal(await readFile(sentinelPath, 'utf8'), 'keep me\n');
  assert.deepEqual(await readdir(externalDir), ['sentinel.txt']);
});

test('writeScenarioSnapshot rejects snapshot directory traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshot-traversal-'));
  const scenarioDir = join(root, 'scenario');
  const outsideDir = join(root, 'outside');
  const sentinelPath = join(outsideDir, 'sentinel.txt');
  const report = createScenarioReport({ scenarioName: 'snapshot-traversal' });

  await mkdir(scenarioDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(sentinelPath, 'keep me\n');

  await assert.rejects(
    () => writeScenarioSnapshot({
      scenarioDir,
      snapshotDirName: '../outside',
      report,
    }),
    /snapshotDirName must be a directory name/,
  );

  assert.deepEqual(await readdir(outsideDir), ['sentinel.txt']);
  assert.equal(await readFile(sentinelPath, 'utf8'), 'keep me\n');
});

test('writeScenarioSnapshot rejects a snapshot path that is not a directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshot-file-'));
  const scenarioDir = join(root, 'scenario');
  const snapshotPath = join(scenarioDir, 'snapshot');
  const report = createScenarioReport({ scenarioName: 'file-snapshot-path' });

  await mkdir(scenarioDir, { recursive: true });
  await writeFile(snapshotPath, 'keep me\n');

  await assert.rejects(
    () => writeScenarioSnapshot({
      scenarioDir,
      snapshotDirName: 'snapshot',
      report,
    }),
    /Snapshot path must be a directory/,
  );

  assert.equal(await readFile(snapshotPath, 'utf8'), 'keep me\n');
});

test('writeScenarioSnapshot preserves unknown and legacy entries when cleanup is unsafe', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshot-unknown-'));
  const scenarioDir = join(root, 'scenario');
  const snapshotDir = join(scenarioDir, 'snapshot');
  const report = createScenarioReport({ scenarioName: 'unknown-snapshot-entry' });

  await mkdir(snapshotDir, { recursive: true });
  await writeFile(join(snapshotDir, 'turns.json'), '[]\n');
  await writeFile(join(snapshotDir, 'notes.txt'), 'keep me\n');

  await assert.rejects(
    () => writeScenarioSnapshot({
      scenarioDir,
      snapshotDirName: 'snapshot',
      report,
    }),
    /unknown entries; refusing to remove them: notes\.txt/,
  );

  assert.deepEqual(await readdir(snapshotDir), ['notes.txt', 'turns.json']);
  assert.equal(await readFile(join(snapshotDir, 'notes.txt'), 'utf8'), 'keep me\n');
  assert.equal(await readFile(join(snapshotDir, 'turns.json'), 'utf8'), '[]\n');
});
