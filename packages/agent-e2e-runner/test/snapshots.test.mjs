import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildSnapshotTurns,
  turnSnapshotDirName,
  writeSnapshotTurns,
} from '../src/snapshots.mjs';

test('turnSnapshotDirName uses stable numbered directories', () => {
  assert.equal(turnSnapshotDirName(0), 'turn-01');
  assert.equal(turnSnapshotDirName(11), 'turn-12');
});

test('buildSnapshotTurns adds per-turn snapshot directory names', () => {
  assert.deepEqual(buildSnapshotTurns([
    {
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Update docs.',
      activity: [{
        type: 'command_execution',
        commandSummary: 'npm test',
        exitCode: 0,
        status: 'completed',
      }],
      changes: [{ path: 'README.md', status: 'modified', content: '# Readme\n' }],
      response: 'Updated README.',
    },
  ]), [
    {
      id: 'request',
      source: 'scenario.json#/turns/0',
      snapshotDir: 'turn-01',
      prompt: 'Update docs.',
      activity: [{
        type: 'command_execution',
        commandSummary: 'npm test',
        exitCode: 0,
        status: 'completed',
      }],
      changes: [{ path: 'README.md', status: 'modified', content: '# Readme\n' }],
      response: 'Updated README.',
    },
  ]);
});

test('writeSnapshotTurns writes inspectable per-turn directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-snapshots-'));

  await mkdir(join(root, 'turn-03/files'), { recursive: true });
  await writeFile(join(root, 'turn-03/files/stale.md'), 'stale\n');

  await writeSnapshotTurns(root, [
    {
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Ask first.',
      activity: [],
      changes: [],
      response: 'Asked for confirmation.',
    },
    {
      id: 'confirm',
      source: 'scenario.json#/turns/1',
      prompt: 'Confirmed.',
      activity: [{
        type: 'command_execution',
        commandSummary: 'npm test',
        exitCode: 0,
        status: 'completed',
      }],
      changes: [{
        path: 'docs/decision.md',
        status: 'created',
        content: '# Decision\n',
      }],
      response: 'Recorded the decision.',
    },
  ]);

  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'turns.json'), 'utf8')).map((turn) => turn.snapshotDir),
    ['turn-01', 'turn-02'],
  );
  assert.equal(await readFile(join(root, 'turn-01/request.txt'), 'utf8'), 'Ask first.\n');
  assert.equal(
    await readFile(join(root, 'turn-01/response.txt'), 'utf8'),
    'Asked for confirmation.\n',
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'turn-02/changes.json'), 'utf8')),
    [{ path: 'docs/decision.md', status: 'created', content: '# Decision\n' }],
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(root, 'turn-02/activity.json'), 'utf8')),
    [{
      type: 'command_execution',
      commandSummary: 'npm test',
      exitCode: 0,
      status: 'completed',
    }],
  );
  assert.equal(
    await readFile(join(root, 'turn-02/files/docs/decision.md'), 'utf8'),
    '# Decision\n',
  );
  assert.equal(
    JSON.parse(await readFile(join(root, 'turn-02/turn.json'), 'utf8')).source,
    'scenario.json#/turns/1',
  );
  assert.equal(await exists(join(root, 'turn-03')), false);
});

async function exists(path) {
  return Boolean(await stat(path).catch(() => null));
}
