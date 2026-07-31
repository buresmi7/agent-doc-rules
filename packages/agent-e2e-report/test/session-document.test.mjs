import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runSessionViewerCli } from '../src/cli.mjs';
import {
  applyScenarioExpectations,
  importCodexExecJsonl,
  importCodexThread,
} from '../src/index.mjs';

test('importCodexExecJsonl normalizes turns, messages, and file patches', () => {
  const input = [
    { type: 'thread.started', thread_id: 'thread-123' },
    { type: 'turn.started', turn_id: 'turn-123' },
    {
      type: 'item.completed',
      item: {
        id: 'command-1',
        type: 'command_execution',
        command: 'npm test',
        exit_code: 0,
        status: 'completed',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'change-1',
        type: 'file_change',
        status: 'completed',
        changes: [{
          path: 'README.md',
          kind: 'update',
          diff: '@@ -1 +1 @@\n-Old\n+New',
        }],
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'message-1',
        type: 'agent_message',
        text: 'Updated README.',
      },
    },
    { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 4 } },
  ].map((event) => JSON.stringify(event)).join('\n');
  const session = importCodexExecJsonl(input, {
    prompts: ['Update the README.'],
  });

  assert.equal(session.session.id, 'thread-123');
  assert.equal(session.session.source.kind, 'codex-exec-jsonl');
  assert.equal(session.turns[0].id, 'turn-123');
  assert.equal(session.turns[0].items[0].type, 'user_message');
  assert.equal(session.turns[0].items.at(-1).type, 'assistant_message');
  assert.deepEqual(session.turns[0].projectChanges, [{
    path: 'README.md',
    status: 'modified',
    patch: '@@ -1 +1 @@\n-Old\n+New',
  }]);
});

test('importCodexThread reads an App Server thread and accepts a scenario overlay', () => {
  const session = importCodexThread({
    thread: {
      id: 'thread-456',
      name: 'Saved Codex chat',
      cwd: '/repo',
      turns: [{
        id: 'turn-1',
        status: 'completed',
        items: [
          {
            id: 'user-1',
            type: 'userMessage',
            content: [{ type: 'text', text: 'Update README.' }],
          },
          {
            id: 'agent-1',
            type: 'agentMessage',
            text: 'Done.',
            phase: 'final',
          },
        ],
      }],
    },
  });
  const withExpectations = applyScenarioExpectations(session, {
    turns: [{
      id: 'request',
      prompt: 'Update README.',
      criteria: {
        docs: 'README explains the change.',
      },
    }],
  });

  assert.equal(withExpectations.session.id, 'thread-456');
  assert.equal(withExpectations.session.source.kind, 'codex-app-server');
  assert.equal(withExpectations.turns[0].items[0].text, 'Update README.');
  assert.deepEqual(withExpectations.turns[0].expectations, [{
    id: 'request.docs',
    text: 'README explains the change.',
    source: 'scenario.json#/turns/0/criteria/docs',
    status: 'not-evaluated',
    reason: '',
    targetItemId: 'agent-1',
  }]);
});

test('agent-session-viewer CLI renders Codex JSONL and normalized session JSON', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-session-viewer-'));
  const inputPath = join(root, 'events.jsonl');
  const outputPath = join(root, 'session.html');
  const sessionPath = join(root, 'agent-session.json');
  const output = [];

  await writeFile(inputPath, [
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-cli' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({
      type: 'item.completed',
      item: {
        id: 'answer',
        type: 'agent_message',
        text: 'Finished.',
      },
    }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n'));

  await runSessionViewerCli([
    inputPath,
    '--format',
    'codex-exec',
    '--prompt',
    'Do the work.',
    '--output',
    outputPath,
    '--session-output',
    sessionPath,
  ], {
    stdout: {
      write(value) {
        output.push(value);
      },
    },
  });

  assert.match(await readFile(outputPath, 'utf8'), /Do the work\./);
  assert.equal(
    JSON.parse(await readFile(sessionPath, 'utf8')).session.id,
    'thread-cli',
  );
  assert.match(output.join(''), /Session viewer:/);
});
