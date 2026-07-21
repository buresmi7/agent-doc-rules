import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readAgentScenarioDefinition } from '../src/agent-scenario-definition.mjs';
import { readProjectSkillDefinition } from '../src/project-package.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('dictated todo example defines five ordered turns with criteria', async () => {
  const scenarioDir = resolve(
    packageRoot,
    'examples/dictated-todo/e2e/messy-dictation',
  );
  const { turns } = await readAgentScenarioDefinition(scenarioDir);

  assert.equal(turns.length, 5);
  assert.deepEqual(
    turns.map((turn) => turn.id),
    [
      'clean-dictation',
      'answer-jane-and-launch',
      'answer-dentist',
      'add-flower',
      'clarify-flower',
    ],
  );
  assert.ok(turns.every((turn) => turn.criteria.length > 0));
});

test('dictated todo fixture installs the local example skill as a dependency', async () => {
  const projectDir = resolve(
    packageRoot,
    'examples/dictated-todo/e2e/messy-dictation/project',
  );

  assert.deepEqual(await readProjectSkillDefinition(projectDir, {
    packageName: '@agent-e2e-example/todo-cleaner',
    name: 'todo-cleaner',
  }), {
    name: 'todo-cleaner',
    packageName: '@agent-e2e-example/todo-cleaner',
    packageSpec: 'file:../../../skills/todo-cleaner',
    installedSkillPath: '.agents/skills/todo-cleaner/SKILL.md',
  });
});
