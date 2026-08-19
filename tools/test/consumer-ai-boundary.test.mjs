import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import test from 'node:test';

import {
  findConsumerAiDependencyViolations,
  findConsumerAiTextViolations,
  findConsumerRuntimeDependencyViolations,
} from '../consumer-ai-boundary.mjs';
import { loadReleaseMetadata, repoRoot } from '../release-metadata.mjs';

const retiredPackage = '@buresmi7/agent-doc-rules-docs-duplicates';
const consumerPackageDirectories = [
  'packages/agent-doc-rules-skill',
  'packages/docs-validator',
];
const runtimeDependencyAllowlist = {
  'packages/agent-doc-rules-skill': [],
  'packages/docs-validator': [
    'dead-or-alive',
    'fast-glob',
    'github-slugger',
    'htmlparser2',
    'markdownlint-cli2',
    'mdast-util-to-string',
    'remark-frontmatter',
    'remark-gfm',
    'remark-lint-no-undefined-references',
    'remark-parse',
    'sentence-splitter',
    'srcset',
    'unified',
    'unist-util-visit',
    'vfile',
    'write-good',
  ],
};
const textExtensions = new Set(['.cjs', '.js', '.json', '.md', '.mjs', '.ts', '.yaml', '.yml']);

test('consumer packages expose no secondary AI runtime requirement', async () => {
  const rootPackage = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
  const docsConfig = JSON.parse(
    await readFile(join(repoRoot, 'agent-doc-rules.config.json'), 'utf8'),
  ).docs;
  const releaseMetadata = await loadReleaseMetadata();

  assert.equal(rootPackage.devDependencies?.[retiredPackage], undefined);
  assert.equal(
    Object.values(rootPackage.scripts ?? {}).some((script) => script.includes('agent-doc-rules-docs-duplicates')),
    false,
  );
  assert.match(
    rootPackage.scripts?.['docs:check'] ?? '',
    /^agent-doc-rules-docs check(?:\s|$)/,
  );
  assert.equal(
    rootPackage.scripts?.['docs:duplicate-candidates'],
    'agent-doc-rules-docs duplicate-candidates --format json',
  );
  assert.equal('style' in docsConfig, false);
  assert.equal('duplicates' in docsConfig, false);
  assert.equal(typeof docsConfig.duplicateCandidates?.minSimilarity, 'number');
  assert.equal('model' in docsConfig.duplicateCandidates, false);
  assert.equal('reasoningEffort' in docsConfig.duplicateCandidates, false);
  assert.equal('codexBin' in docsConfig.duplicateCandidates, false);
  assert.equal(
    releaseMetadata.packages.some((entry) => entry.name === retiredPackage),
    false,
  );
  await assert.rejects(
    access(join(repoRoot, 'packages/docs-duplicates')),
    { code: 'ENOENT' },
  );

  for (const directory of consumerPackageDirectories) {
    await assertPublishedBoundary(directory);
  }
});

test('consumer boundary detector catches another AI CLI and SDK', () => {
  const content = [
    "import Anthropic from '@anthropic-ai/sdk';",
    "spawn('claude', ['--print', 'Review these docs']);",
    "fetch('https://api.anthropic.com/v1/messages');",
  ].join('\n');
  const manifest = {
    dependencies: {
      '@anthropic-ai/sdk': '1.0.0',
    },
  };

  assert.deepEqual(
    findConsumerAiDependencyViolations(manifest),
    ['dependencies.@anthropic-ai/sdk'],
  );
  assert.deepEqual(
    findConsumerAiTextViolations(content).map((entry) => entry.label).sort(),
    [
      'AI SDK import',
      'AI executable literal',
      'AI provider endpoint',
      'secondary AI CLI process',
    ],
  );
});

test('consumer boundary detector catches the retired dynamic Codex invocation shape', () => {
  const content = [
    "import crossSpawn from 'cross-spawn';",
    "const command = codexBin ?? 'codex';",
    "const args = ['exec', '--config', `model_reasoning_effort=${reasoningEffort}`];",
    "crossSpawn(command, args);",
  ].join('\n');
  const manifest = {
    dependencies: {
      'cross-spawn': '7.0.6',
    },
  };

  assert.deepEqual(
    findConsumerRuntimeDependencyViolations(manifest, []),
    ['dependencies.cross-spawn'],
  );
  assert.deepEqual(
    [...new Set(findConsumerAiTextViolations(content).map((entry) => entry.label))].sort(),
    ['AI executable literal', 'retired AI runtime identifier'],
  );
});

test('consumer boundary permits retired package names only in removal guidance', () => {
  const migration = 'Remove @openai/codex and the retired agent-doc-rules-docs-duplicates package.';

  assert.deepEqual(
    findConsumerAiTextViolations(migration, { allowRetiredMigration: true }),
    [],
  );
  assert.equal(findConsumerAiTextViolations(migration).length, 2);
});

async function assertPublishedBoundary(directory) {
  const packageDirectory = join(repoRoot, directory);
  const manifest = JSON.parse(await readFile(join(packageDirectory, 'package.json'), 'utf8'));
  const dependencyViolations = findConsumerAiDependencyViolations(manifest);

  assert.deepEqual(
    dependencyViolations,
    [],
    `${directory}/package.json declares secondary AI runtime dependencies`,
  );
  assert.deepEqual(
    findConsumerRuntimeDependencyViolations(
      manifest,
      runtimeDependencyAllowlist[directory],
    ),
    [],
    `${directory}/package.json changed the audited consumer runtime dependency set`,
  );

  const files = [join(packageDirectory, 'package.json')];

  for (const entry of manifest.files ?? []) {
    files.push(...await collectFiles(join(packageDirectory, entry)));
  }

  for (const file of files.filter((path) => textExtensions.has(extname(path)))) {
    const label = relative(repoRoot, file).replaceAll('\\', '/');
    const content = await readFile(file, 'utf8');
    const allowRetiredMigration = (
      label.endsWith('/docs/adoption.md')
      || label === 'packages/docs-validator/README.md'
    );
    const violations = findConsumerAiTextViolations(content, { allowRetiredMigration });

    assert.deepEqual(violations, [], `${label} contains a secondary AI runtime contract`);
  }
}

async function collectFiles(path) {
  const info = await stat(path);

  if (info.isFile()) {
    return [path];
  }

  const files = [];

  for (const entry of await readdir(path, { withFileTypes: true })) {
    files.push(...await collectFiles(join(path, entry.name)));
  }

  return files;
}
