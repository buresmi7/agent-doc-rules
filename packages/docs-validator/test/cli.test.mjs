import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { parseArgs, runCommand } from '../src/cli.mjs';
import { resolveDocsOptions } from '../src/config.mjs';
import {
  buildLinkinatorArgs,
  buildMarkdownlintArgs,
  resolveMarkdownFiles,
  runCheck,
} from '../src/runner.mjs';

test('include and exclude globs resolve Markdown files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-files-'));
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'node_modules/pkg'), { recursive: true });
  await writeFile(join(root, 'README.md'), '# Readme\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  await writeFile(join(root, 'node_modules/pkg/README.md'), '# Package\n');

  const files = await resolveMarkdownFiles({
    root,
    include: ['*.md', 'docs/**/*.md', 'node_modules/**/*.md'],
    exclude: ['node_modules/**'],
  });

  assert.deepEqual(files, ['docs/guide.md', 'README.md']);
});

test('markdown command builds markdownlint include and exclude args', () => {
  assert.deepEqual(
    buildMarkdownlintArgs({
      include: ['*.md', 'docs/**/*.md'],
      exclude: ['node_modules/**'],
    }),
    ['*.md', 'docs/**/*.md', '!node_modules/**', '!**/node_modules/**'],
  );
});

test('link command includes markdown and fragment flags', () => {
  assert.deepEqual(
    buildLinkinatorArgs({
      files: ['README.md'],
      skip: [],
      checkFragments: true,
    }),
    ['--markdown', '--directory-listing', '--check-fragments', 'README.md'],
  );
});

test('link command maps repeated skip flags', () => {
  assert.deepEqual(
    buildLinkinatorArgs({
      files: ['README.md'],
      skip: ['^https://', '^mailto:'],
      checkFragments: true,
    }),
    [
      '--markdown',
      '--directory-listing',
      '--check-fragments',
      '--skip',
      '^https://',
      '--skip',
      '^mailto:',
      'README.md',
    ],
  );
});

test('link command can omit fragment checking', () => {
  assert.deepEqual(
    buildLinkinatorArgs({
      files: ['README.md'],
      skip: [],
      checkFragments: false,
    }),
    ['--markdown', '--directory-listing', 'README.md'],
  );
});

test('check stops on the first failing subcheck', async () => {
  const calls = [];
  const code = await runCheck(
    { root: process.cwd(), include: ['*.md'], exclude: [] },
    {
      runMarkdown: async () => {
        calls.push('markdown');
        return 2;
      },
      runLinks: async () => {
        calls.push('links');
        return 0;
      },
    },
  );

  assert.equal(code, 2);
  assert.deepEqual(calls, ['markdown']);
});

test('check can pass separate markdown and link options', async () => {
  const calls = [];
  const code = await runCheck(
    {
      markdownOptions: { include: ['*.md'] },
      linksOptions: { include: ['docs/**/*.md'] },
    },
    {
      runMarkdown: async (options) => {
        calls.push(['markdown', options.include]);
        return 0;
      },
      runLinks: async (options) => {
        calls.push(['links', options.include]);
        return 0;
      },
    },
  );

  assert.equal(code, 0);
  assert.deepEqual(calls, [
    ['markdown', ['*.md']],
    ['links', ['docs/**/*.md']],
  ]);
});

test('cli flags override config defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-config-'));
  await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
    docs: {
      include: ['docs/**/*.md'],
      exclude: ['dist/**'],
      links: {
        skip: ['^https://example.invalid'],
      },
    },
  }));

  const options = await resolveDocsOptions({
    ...parseArgs(['links', '--root', root, '--include', '*.md', '--skip', '^https://override.invalid']),
  });

  assert.deepEqual(options.include, ['*.md']);
  assert.deepEqual(options.exclude, ['dist/**']);
  assert.deepEqual(options.skip, ['^https://override.invalid']);
});

test('runCommand dispatches check command', async () => {
  const code = await runCommand('check', {}, {
    runMarkdown: async () => 0,
    runLinks: async () => 0,
  });

  assert.equal(code, 0);
});
