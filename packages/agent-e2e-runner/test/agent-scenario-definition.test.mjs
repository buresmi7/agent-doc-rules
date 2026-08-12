import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  formatScenarioCriteria,
  formatTranscript,
  readAgentScenarioDefinition,
} from '../src/agent-scenario-definition.mjs';

test('readAgentScenarioDefinition reads ordered turns and named criteria', async () => {
  const root = await createScenario({
    turns: [
      {
        id: 'request',
        prompt: ' Fix the blocked review. ',
        criteria: {
          'ask-first': ' Ask before editing. ',
        },
      },
      {
        id: 'confirm',
        prompt: 'Yes, proceed.',
        criteria: {
          'apply-answer': 'Apply the confirmed change.',
        },
      },
    ],
  });

  assert.deepEqual(await readAgentScenarioDefinition(root), {
    source: 'scenario.json',
    turns: [
      {
        id: 'request',
        source: 'scenario.json#/turns/0',
        prompt: 'Fix the blocked review.',
        criteria: [{
          id: 'request.ask-first',
          source: 'scenario.json#/turns/0/criteria/ask-first',
          content: 'Ask before editing.',
        }],
      },
      {
        id: 'confirm',
        source: 'scenario.json#/turns/1',
        prompt: 'Yes, proceed.',
        criteria: [{
          id: 'confirm.apply-answer',
          source: 'scenario.json#/turns/1/criteria/apply-answer',
          content: 'Apply the confirmed change.',
        }],
      },
    ],
  });
});

test('formatScenarioCriteria gives the judge stable criterion ids', () => {
  const output = formatScenarioCriteria([{
    id: 'request',
    source: 'scenario.json#/turns/0',
    criteria: [{
      id: 'request.no-changes',
      content: 'No files change.\nThe agent asks first.',
    }],
  }]);

  assert.equal(output, `## Turn 1: request

Source: scenario.json#/turns/0

- [request.no-changes] No files change.
  The agent asks first.`);
});

test('formatTranscript summarizes each turn for judgment', () => {
  assert.equal(formatTranscript([
    {
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Fix the blocked review.',
      changes: [],
      response: 'Asked for confirmation.',
    },
    {
      id: 'confirm',
      source: 'scenario.json#/turns/1',
      prompt: 'Confirmed.',
      changes: [{ path: 'docs/decision.md', content: '# Decision\n' }],
      response: 'Recorded the decision.',
    },
  ]), `Turn 1 (request, scenario.json#/turns/0)
User: Fix the blocked review.
Files: none
Agent: Asked for confirmation.

Turn 2 (confirm, scenario.json#/turns/1)
User: Confirmed.
Files: docs/decision.md
Agent: Recorded the decision.`);
});

test('readAgentScenarioDefinition requires valid scenario.json', async () => {
  const missing = await mkdtemp(join(tmpdir(), 'agent-e2e-definition-missing-'));
  const malformed = await mkdtemp(join(tmpdir(), 'agent-e2e-definition-json-'));

  await writeFile(join(malformed, 'scenario.json'), '{');

  await assert.rejects(
    () => readAgentScenarioDefinition(missing),
    /must include scenario\.json/,
  );
  await assert.rejects(
    () => readAgentScenarioDefinition(malformed),
    /Invalid JSON in scenario\.json/,
  );
});

test('readAgentScenarioDefinition requires a non-empty turns array', async () => {
  const empty = await createScenario({ turns: [] });
  const wrongType = await createScenario({ turns: {} });

  await assert.rejects(
    () => readAgentScenarioDefinition(empty),
    /turns must be a non-empty array/,
  );
  await assert.rejects(
    () => readAgentScenarioDefinition(wrongType),
    /turns must be a non-empty array/,
  );
});

test('readAgentScenarioDefinition rejects unknown properties', async () => {
  const root = await createScenario({
    turns: [{
      id: 'request',
      prompt: 'Do the work.',
      criteria: { pass: 'The work is done.' },
      criterion: 'typo',
    }],
  });

  await assert.rejects(
    () => readAgentScenarioDefinition(root),
    /contains unknown property "criterion"/,
  );
});

test('readAgentScenarioDefinition requires unique kebab-case turn ids', async () => {
  const invalid = await createScenario({
    turns: [{ id: 'First Turn', prompt: 'One.', criteria: { pass: 'Pass.' } }],
  });
  const duplicate = await createScenario({
    turns: [
      { id: 'request', prompt: 'One.', criteria: { pass: 'Pass.' } },
      { id: 'request', prompt: 'Two.', criteria: { pass: 'Pass.' } },
    ],
  });

  await assert.rejects(
    () => readAgentScenarioDefinition(invalid),
    /id must be a kebab-case identifier/,
  );
  await assert.rejects(
    () => readAgentScenarioDefinition(duplicate),
    /duplicates turn id "request"/,
  );

  const oversized = await createScenario({
    turns: [{
      id: `a${'b'.repeat(128)}`,
      prompt: 'One.',
      criteria: { pass: 'Pass.' },
    }],
  });

  await assert.rejects(
    () => readAgentScenarioDefinition(oversized),
    /id must not exceed 128 bytes/,
  );
});

test('readAgentScenarioDefinition requires a prompt and named criteria', async () => {
  const blankPrompt = await createScenario({
    turns: [{ id: 'request', prompt: ' ', criteria: { pass: 'Pass.' } }],
  });
  const emptyCriteria = await createScenario({
    turns: [{ id: 'request', prompt: 'Do it.', criteria: {} }],
  });
  const blankCriterion = await createScenario({
    turns: [{ id: 'request', prompt: 'Do it.', criteria: { pass: ' ' } }],
  });

  await assert.rejects(
    () => readAgentScenarioDefinition(blankPrompt),
    /prompt must be a non-empty string/,
  );
  await assert.rejects(
    () => readAgentScenarioDefinition(emptyCriteria),
    /criteria must contain at least one criterion/,
  );
  await assert.rejects(
    () => readAgentScenarioDefinition(blankCriterion),
    /criteria\.pass must be a non-empty string/,
  );
});

test('readAgentScenarioDefinition rejects legacy agent scenario files', async (t) => {
  for (const entry of ['turns', 'criteria', 'prompt.md', 'criteria.md']) {
    await t.test(entry, async () => {
      const root = await createScenario({
        turns: [{ id: 'request', prompt: 'Do it.', criteria: { pass: 'Pass.' } }],
      });
      const path = join(root, entry);

      if (entry.includes('.')) {
        await writeFile(path, 'legacy\n');
      } else {
        await mkdir(path);
      }

      await assert.rejects(
        () => readAgentScenarioDefinition(root),
        new RegExp(`remove legacy ${entry.replace('.', '\\.')}`),
      );
    });
  }
});

async function createScenario(value) {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-definition-'));

  await writeFile(join(root, 'scenario.json'), `${JSON.stringify(value, null, 2)}\n`);
  return root;
}
