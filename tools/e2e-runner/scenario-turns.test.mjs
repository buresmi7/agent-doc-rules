import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildTurnPrompt,
  formatTurnNotes,
  readScenarioTurns,
} from './scenario-turns.mjs';

test('readScenarioTurns falls back to prompt.md for single-turn scenarios', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-turns-single-'));

  await writeFile(join(root, 'prompt.md'), '# Prompt\n\nUpdate the docs.\n');

  assert.deepEqual(await readScenarioTurns(root), [{
    id: 'prompt',
    source: 'prompt.md',
    prompt: '# Prompt\n\nUpdate the docs.',
  }]);
});

test('readScenarioTurns reads numbered Markdown turns in order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-turns-multi-'));

  await mkdir(join(root, 'turns'));
  await writeFile(join(root, 'turns/02-confirm.md'), 'Yes, accept the trade-off.\n');
  await writeFile(join(root, 'turns/01-request.md'), 'Fix the blocked review.\n');

  assert.deepEqual(await readScenarioTurns(root), [
    {
      id: '01-request',
      source: 'turns/01-request.md',
      prompt: 'Fix the blocked review.',
    },
    {
      id: '02-confirm',
      source: 'turns/02-confirm.md',
      prompt: 'Yes, accept the trade-off.',
    },
  ]);
});

test('readScenarioTurns rejects mixed prompt and turn files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-turns-mixed-'));

  await mkdir(join(root, 'turns'));
  await writeFile(join(root, 'prompt.md'), 'Old prompt.\n');
  await writeFile(join(root, 'turns/01-request.md'), 'New prompt.\n');

  await assert.rejects(
    () => readScenarioTurns(root),
    /either prompt\.md or turns\/\*\.md, not both/,
  );
});

test('buildTurnPrompt includes previous turn context without file content', () => {
  const prompt = buildTurnPrompt({
    currentTurn: {
      source: 'turns/02-confirm.md',
      prompt: 'Yes, proceed.',
    },
    previousTurns: [{
      source: 'turns/01-request.md',
      prompt: 'Fix the blocked review.',
      generatedFiles: [],
      notes: 'Need confirmation before changing validation.',
    }],
  });

  assert.match(prompt, /# Current User Request/);
  assert.match(prompt, /Yes, proceed\./);
  assert.match(prompt, /# Previous Turns/);
  assert.ok(prompt.indexOf('# Previous Turns') < prompt.indexOf('# Current User Request'));
  assert.match(prompt, /Files changed: none/);
  assert.match(prompt, /Need confirmation before changing validation\./);
});

test('formatTurnNotes summarizes each turn for judgment and snapshots', () => {
  assert.equal(formatTurnNotes([
    {
      source: 'turns/01-request.md',
      prompt: 'Fix the blocked review.',
      generatedFiles: [],
      notes: 'Asked for confirmation.',
    },
    {
      source: 'turns/02-confirm.md',
      prompt: 'Confirmed.',
      generatedFiles: [{ path: 'docs/decision.md', content: '# Decision\n' }],
      notes: 'Recorded the decision.',
    },
  ]), `Turn 1 (turns/01-request.md)
User: Fix the blocked review.
Files: none
Notes: Asked for confirmation.

Turn 2 (turns/02-confirm.md)
User: Confirmed.
Files: docs/decision.md
Notes: Recorded the decision.`);
});
