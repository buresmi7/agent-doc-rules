import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultJudgePromptTemplate } from '../src/defaults.mjs';
import { render } from '../src/prompts.mjs';

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
  assert.doesNotMatch(prompt, /skillReference/);
  assert.doesNotMatch(prompt, /Installed skill/);
});
