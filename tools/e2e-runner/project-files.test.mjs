import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  collectFinalGeneratedFiles,
  formatGeneratedFiles,
  formatGeneratedTurns,
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

test('readProjectFiles hides harness-only package scripts and includes project evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-files-'));

  await mkdir(join(root, '.agents/skills/agent-doc-rules'), { recursive: true });
  await mkdir(join(root, 'dist'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'index.js'), 'export const root = true;\n');
  await writeFile(join(root, 'dist/bundle.js'), 'export const bundled = true;\n');
  await writeFile(join(root, 'README.md'), '# Project\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  await writeFile(join(root, 'src/index.js'), 'export const name = "fixture";\n');
  await writeFile(join(root, 'agent-doc-rules.config.json'), '{"docs":{}}\n');
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
  assert.match(output, /--- src\/index\.js ---/);
  assert.match(output, /--- agent-doc-rules\.config\.json ---/);
  assert.match(output, /"test": "node --test"/);
  assert.doesNotMatch(output, /test:agent/);
  assert.doesNotMatch(output, /skills-lock/);
  assert.doesNotMatch(output, /Skill/);
  assert.doesNotMatch(output, /--- index\.js ---/);
  assert.doesNotMatch(output, /dist\/bundle\.js/);
});

test('formatGeneratedFiles renders file blocks for the judge prompt', () => {
  assert.equal(
    formatGeneratedFiles([{ path: 'AGENTS.md', content: '# Agents\n' }]),
    '--- AGENTS.md ---\n# Agents\n',
  );
});

test('collectFinalGeneratedFiles keeps the latest generated version per path', () => {
  assert.deepEqual(collectFinalGeneratedFiles([
    {
      generatedFiles: [
        { path: 'README.md', content: '# Old\n' },
        { path: 'docs/a.md', content: '# A\n' },
      ],
    },
    {
      generatedFiles: [
        { path: 'README.md', content: '# New\n' },
      ],
    },
  ]), [
    { path: 'docs/a.md', content: '# A\n' },
    { path: 'README.md', content: '# New\n' },
  ]);
});

test('formatGeneratedTurns includes per-turn notes and generated files', () => {
  assert.equal(formatGeneratedTurns([
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
  ]), `## Turn 1: turns/01-request.md

User request:

Fix the blocked review.

Agent notes:

Asked for confirmation.

Generated files:

(none)

## Turn 2: turns/02-confirm.md

User request:

Confirmed.

Agent notes:

Recorded the decision.

Generated files:

--- docs/decision.md ---
# Decision
`);
});
