import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertProjectPathsUnchanged,
  captureProjectState,
  diffProjectStates,
  formatAgentActivity,
  formatConversationTurns,
  formatFileChanges,
  prepareProjectFixture,
  readProjectFiles,
} from '../src/project-files.mjs';

test('prepareProjectFixture removes only harness-owned package scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-prepare-'));

  await writeFile(join(root, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node --test',
      'test:agent': 'node runner.mjs',
    },
  }));

  await prepareProjectFixture(root);

  const output = await readProjectFiles(root);
  assert.match(output, /"test": "node --test"/);
  assert.doesNotMatch(output, /test:agent/);
});

test('captureProjectState and diffProjectStates report real file changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-state-'));

  await mkdir(join(root, 'docs'));
  await mkdir(join(root, 'dist'));
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'README.md'), '# Before\n');
  await writeFile(join(root, 'dist/bundle.js'), 'before\n');
  await writeFile(join(root, 'node_modules/cache.txt'), 'before\n');
  await writeFile(join(root, 'old.txt'), 'old\n');
  const before = await captureProjectState(root);

  await writeFile(join(root, 'README.md'), '# After\n');
  await writeFile(join(root, 'docs/new.md'), '# New\n');
  await writeFile(join(root, 'dist/bundle.js'), 'after\n');
  await writeFile(join(root, 'node_modules/cache.txt'), 'after\n');
  await rm(join(root, 'old.txt'));
  const after = await captureProjectState(root);

  assert.deepEqual(diffProjectStates(before, after), [
    { path: 'dist/bundle.js', status: 'modified', content: 'after\n' },
    { path: 'docs/new.md', status: 'created', content: '# New\n' },
    { path: 'old.txt', status: 'deleted' },
    { path: 'README.md', status: 'modified', content: '# After\n' },
  ]);
});

test('assertProjectPathsUnchanged rejects installed skill changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-protected-'));
  const skillDir = join(root, '.agents/skills/example');

  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, 'SKILL.md'), '# Original\n');
  const before = await captureProjectState(root);
  await writeFile(join(skillDir, 'SKILL.md'), '# Changed\n');
  const after = await captureProjectState(root);

  assert.throws(
    () => assertProjectPathsUnchanged(before, after, {
      pathPrefixes: ['.agents/skills/example/'],
    }),
    /modified protected runner files/,
  );
});

test('readProjectFiles includes text evidence and hides runner artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-files-'));

  await mkdir(join(root, '.agents/skills/example-skill'), { recursive: true });
  await mkdir(join(root, 'dist'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'index.js'), 'export const root = true;\n');
  await writeFile(join(root, 'dist/bundle.js'), 'export const bundled = true;\n');
  await writeFile(join(root, 'README.md'), '# Project\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  await writeFile(join(root, 'src/index.ts'), 'export const name = "fixture";\n');
  await writeFile(join(root, 'tool.config.json'), '{"docs":{}}\n');
  await writeFile(join(root, 'skills-lock.json'), '{}\n');
  await writeFile(join(root, '.agents/skills/example-skill/SKILL.md'), '# Skill\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node --test',
      'test:agent': 'node runner.mjs',
    },
  }, null, 2));

  const output = await readProjectFiles(root, {
    ignoredPathPrefixes: ['.agents/skills/example-skill/'],
  });

  assert.match(output, /--- README.md ---/);
  assert.match(output, /--- docs\/guide.md ---/);
  assert.match(output, /--- index\.js ---/);
  assert.match(output, /--- src\/index\.ts ---/);
  assert.match(output, /--- tool\.config\.json ---/);
  assert.match(output, /"test": "node --test"/);
  assert.doesNotMatch(output, /test:agent/);
  assert.doesNotMatch(output, /skills-lock/);
  assert.doesNotMatch(output, /# Skill/);
  assert.doesNotMatch(output, /dist\/bundle\.js/);
});

test('readProjectFiles fails instead of silently truncating judge evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-budget-'));

  await writeFile(join(root, 'README.md'), '# Project\n');

  await assert.rejects(
    () => readProjectFiles(root, { maxEvidenceFileBytes: 4 }),
    /Judge evidence file exceeds 4 bytes: README\.md/,
  );
});

test('formatFileChanges renders status and content for the judge', () => {
  assert.equal(
    formatFileChanges([
      { path: 'AGENTS.md', status: 'created', content: '# Agents\n' },
      { path: 'old.md', status: 'deleted' },
    ]),
    '--- AGENTS.md (created) ---\n# Agents\n\n\n--- old.md (deleted) ---\n(deleted)',
  );
});

test('formatConversationTurns includes real responses and per-turn file changes', () => {
  assert.equal(formatConversationTurns([
    {
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Fix the blocked review.',
      activity: [{
        type: 'command_execution',
        commandSummary: 'npm test',
        exitCode: 0,
        status: 'completed',
      }],
      changes: [],
      response: 'May I proceed?',
    },
    {
      id: 'confirm',
      source: 'scenario.json#/turns/1',
      prompt: 'Confirmed.',
      changes: [{
        path: 'docs/decision.md',
        status: 'created',
        content: '# Decision\n',
      }],
      response: 'Recorded the decision.',
    },
  ]), `## Turn 1: request (scenario.json#/turns/0)

User request:

Fix the blocked review.

Agent response:

May I proceed?

Agent tool activity:

- command (exit 0): npm test

Files changed during this turn:

(none)

## Turn 2: confirm (scenario.json#/turns/1)

User request:

Confirmed.

Agent response:

Recorded the decision.

Agent tool activity:

(none recorded)

Files changed during this turn:

--- docs/decision.md (created) ---
# Decision
`);
});

test('formatAgentActivity renders commands and file tools without their output', () => {
  assert.equal(formatAgentActivity([
    {
      type: 'file_change',
      status: 'completed',
      changes: [
        { path: 'README.md', kind: 'update' },
        { path: 'docs/new.md', kind: 'add' },
      ],
    },
    {
      type: 'mcp_tool_call',
      server: 'issues',
      tool: 'get_issue',
      status: 'completed',
    },
  ]), [
    '- file change (completed): update README.md, add docs/new.md',
    '- MCP tool (completed): issues/get_issue',
  ].join('\n'));
});
