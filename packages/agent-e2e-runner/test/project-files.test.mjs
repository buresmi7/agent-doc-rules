import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertProjectPathsUnchanged,
  captureProjectState,
  diffProjectStates,
  diffProjectStatesForReport,
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

test('captureProjectState fails before reading files beyond configured limits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-state-limit-'));

  await writeFile(join(root, 'large.txt'), '12345');

  await assert.rejects(
    () => captureProjectState(root, { maxStateFileBytes: 4 }),
    /Project state file exceeds 4 bytes: large\.txt/,
  );
  await assert.rejects(
    () => captureProjectState(root, { maxStateFiles: 0 }),
    /exceeds the 0-file limit/,
  );
  await assert.rejects(
    () => captureProjectState(root, { maxStateBytes: 4 }),
    /Project state exceeds 4 bytes while reading: large\.txt/,
  );
});

test('diffProjectStatesForReport creates bounded unified patches', () => {
  const before = new Map([
    ['README.md', Buffer.from('# Before\n')],
    ['deleted.txt', Buffer.from('removed\n')],
    ['binary.dat', Buffer.from([0, 1, 2])],
  ]);
  const after = new Map([
    ['README.md', Buffer.from('# After\n')],
    ['created.txt', Buffer.from('too large')],
    ['binary.dat', Buffer.from([0, 1, 3])],
  ]);

  assert.deepEqual(diffProjectStatesForReport(before, after, {
    maxFileBytes: 8,
  }), [
    {
      path: 'binary.dat',
      status: 'modified',
      before: { kind: 'binary', byteLength: 3 },
      after: { kind: 'binary', byteLength: 3 },
      patch: null,
      omission: { reason: 'binary' },
    },
    {
      path: 'created.txt',
      status: 'created',
      before: null,
      after: { kind: 'omitted', byteLength: 9 },
      patch: null,
      omission: { reason: 'file-too-large' },
    },
    {
      path: 'deleted.txt',
      status: 'deleted',
      before: { kind: 'text', byteLength: 8 },
      after: null,
      patch: {
        format: 'unified',
        lines: [
          '--- a/deleted.txt',
          '+++ /dev/null',
          '@@ -1 +0,0 @@',
          '-removed',
        ],
      },
      omission: null,
    },
    {
      path: 'README.md',
      status: 'modified',
      before: { kind: 'omitted', byteLength: 9 },
      after: { kind: 'text', byteLength: 8 },
      patch: null,
      omission: { reason: 'file-too-large' },
    },
  ]);
});

test('diffProjectStatesForReport omits sensitive and over-budget patches', () => {
  const before = new Map([
    ['.env', Buffer.from('TOKEN=before\n')],
    ['README.md', Buffer.from('# Before\n')],
  ]);
  const after = new Map([
    ['.env', Buffer.from('TOKEN=after\n')],
    ['README.md', Buffer.from('# After\n')],
  ]);

  const changes = diffProjectStatesForReport(before, after, {
    budget: { remainingBytes: 1 },
  });

  assert.equal(changes[0].path, '.env');
  assert.deepEqual(changes[0].omission, { reason: 'sensitive-path' });
  assert.equal(changes[0].patch, null);
  assert.equal(changes[1].path, 'README.md');
  assert.equal(changes[1].omission.reason, 'report-budget');
  assert.equal(changes[1].patch, null);
});

test('diffProjectStatesForReport fails when the change-count limit is exceeded', () => {
  const after = new Map([
    ['one.txt', Buffer.from('one\n')],
    ['two.txt', Buffer.from('two\n')],
  ]);

  assert.throws(
    () => diffProjectStatesForReport(new Map(), after, { maxChanges: 1 }),
    /Report diff exceeds the 1-change limit/,
  );
});

test('diffProjectStatesForReport omits common credentials, private keys, and empty files', () => {
  const changes = diffProjectStatesForReport(new Map(), new Map([
    ['.aws/credentials', Buffer.from('[default]\naws_secret_access_key=secret\n')],
    ['.kube/config', Buffer.from('users: []\n')],
    ['.ssh/custom-deploy-key', Buffer.from('private key bytes\n')],
    ['.ssh/id_ed25519', Buffer.from('private key bytes\n')],
    ['credentials.json', Buffer.from('{"token":"secret"}\n')],
    ['empty.txt', Buffer.alloc(0)],
    ['old-key.asc', Buffer.from(
      '-----BEGIN PGP PRIVATE KEY BLOCK-----\nsecret\n-----END PGP PRIVATE KEY BLOCK-----\n',
    )],
    ['renamed-key.txt', Buffer.from(
      '-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n-----END OPENSSH PRIVATE KEY-----\n',
    )],
  ]));
  const byPath = new Map(changes.map((change) => [change.path, change]));

  assert.equal(byPath.get('.aws/credentials').omission.reason, 'sensitive-path');
  assert.equal(byPath.get('.kube/config').omission.reason, 'sensitive-path');
  assert.equal(byPath.get('.ssh/custom-deploy-key').omission.reason, 'sensitive-path');
  assert.equal(byPath.get('.ssh/id_ed25519').omission.reason, 'sensitive-path');
  assert.equal(byPath.get('credentials.json').omission.reason, 'sensitive-path');
  assert.equal(byPath.get('old-key.asc').omission.reason, 'sensitive-content');
  assert.equal(byPath.get('renamed-key.txt').omission.reason, 'sensitive-content');
  assert.deepEqual(byPath.get('empty.txt').omission, { reason: 'empty-file' });
  assert.equal(byPath.get('empty.txt').patch, null);
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
