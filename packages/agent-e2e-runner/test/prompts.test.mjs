import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultJudgePromptTemplate } from '../src/defaults.mjs';
import { judgeSchema, render } from '../src/prompts.mjs';

test('default judge prompt evaluates the real conversation without seeing the skill', () => {
  const prompt = render(defaultJudgePromptTemplate, {
    criteria: '- Ask which Jane.',
    originalProjectFiles: '--- TODO.md ---\n# TODO\n',
    projectFiles: '--- TODO.md ---\n# TODO\n',
    changes: '(none)',
    transcript: 'User: Call Jane.\nAgent: Which Jane?',
  });

  assert.match(prompt, /real Codex session/);
  assert.match(prompt, /User: Call Jane/);
  assert.match(prompt, /Agent: Which Jane/);
  assert.match(prompt, /failedCriteria` is exhaustive/);
  assert.match(prompt, /criterion omitted from this array is recorded as passed/);
  assert.doesNotMatch(prompt, /skillReference/);
  assert.doesNotMatch(prompt, /Installed skill/);
});

test('judge score schema uses the same zero-to-one range as passThreshold', () => {
  assert.equal(judgeSchema.properties.score.minimum, 0);
  assert.equal(judgeSchema.properties.score.maximum, 1);
});
