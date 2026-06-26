import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  formatGeneratedFiles,
  normalizeGeneratedFiles,
  readProjectFiles,
} from './project-files.mjs';

test('normalizeGeneratedFiles sorts files and adds a trailing newline', () => {
  assert.deepEqual(
    normalizeGeneratedFiles([
      { path: 'docs/guide.md', content: '# Guide' },
      { path: './AGENTS.md', content: '# Agents\n' },
    ]),
    [
      { path: 'AGENTS.md', content: '# Agents\n' },
      { path: 'docs/guide.md', content: '# Guide\n' },
    ],
  );
});

test('normalizeGeneratedFiles rejects unsafe paths', () => {
  assert.throws(
    () => normalizeGeneratedFiles([{ path: '../README.md', content: 'bad' }]),
    /unsafe file path/,
  );
  assert.throws(
    () => normalizeGeneratedFiles([{ path: '.agents/skills/agent-doc-rules/SKILL.md', content: 'bad' }]),
    /must not modify installed skill files/,
  );
});

test('readProjectFiles hides harness-only package scripts and installed skills', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-files-'));

  await mkdir(join(root, '.agents/skills/agent-doc-rules'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'README.md'), '# Project\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  await writeFile(join(root, 'skills-lock.json'), '{}\n');
  await writeFile(join(root, '.agents/skills/agent-doc-rules/SKILL.md'), '# Skill\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node --test',
      'test:agent': 'node ../../../tools/run-agent-e2e-scenario.mjs',
    },
  }, null, 2));

  const output = await readProjectFiles(root);

  assert.match(output, /--- README.md ---/);
  assert.match(output, /--- docs\/guide.md ---/);
  assert.match(output, /"test": "node --test"/);
  assert.doesNotMatch(output, /test:agent/);
  assert.doesNotMatch(output, /skills-lock/);
  assert.doesNotMatch(output, /Skill/);
});

test('formatGeneratedFiles renders file blocks for the judge prompt', () => {
  assert.equal(
    formatGeneratedFiles([{ path: 'AGENTS.md', content: '# Agents\n' }]),
    '--- AGENTS.md ---\n# Agents\n',
  );
});
