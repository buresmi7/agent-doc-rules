import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGeneratePrompt } from './prompts.mjs';

test('buildGeneratePrompt does not force skill selection or shortcut behavior', () => {
  const prompt = buildGeneratePrompt({
    scenarioPrompt: 'Can we use the temporary workaround?',
    projectFiles: '--- README.md ---\n# Project\n',
    skillContext: '',
  });

  assert.match(prompt, /Can we use the temporary workaround\?/);
  assert.match(prompt, /If no file changes are needed, return an empty `files` array/);
  assert.match(prompt, /Do not omit required warnings, trade-offs, risks, repair paths, or questions/);
  assert.doesNotMatch(prompt, /\$agent-doc-rules/);
  assert.doesNotMatch(prompt, /confirmation request/i);
  assert.doesNotMatch(prompt, /agent-doc-rules\/SKILL\.md/);
});
