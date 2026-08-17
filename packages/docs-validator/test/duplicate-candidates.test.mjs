import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  estimateCandidateComparisons,
  findCandidatePairs,
  isIgnoredPair,
  MAX_CANDIDATE_COMPARISONS,
  normalizeIgnorePairs,
  paginateCandidates,
  selectCandidatePage,
} from '../src/duplicate-candidates.mjs';
import {
  formatDuplicateCandidatesJson,
  formatDuplicateCandidatesText,
  runDuplicateCandidates,
  sourceDigest,
} from '../src/duplicate-candidates-command.mjs';
import {
  extractMarkdownUnits,
  resolveDuplicateFiles,
} from '../src/duplicate-markdown.mjs';
import { parseArgs, runCommand } from '../src/cli.mjs';
import { resolveDuplicateCandidateOptions } from '../src/config.mjs';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliBin = join(packageRoot, 'bin/agent-doc-rules-docs.mjs');

test('Markdown extraction skips code blocks, tables, and short noise', () => {
  const units = extractMarkdownUnits({
    file: 'README.md',
    minWords: 4,
    minChars: 20,
    content: `# Docs

Run the docs check before changing reusable documentation rules.

\`\`\`md
Run the docs check before changing reusable documentation rules.
\`\`\`

| Task | Command |
| --- | --- |
| Generate duplicate candidates | \`pnpm docs:duplicate-candidates\` |

Tiny.
`,
  });

  assert.deepEqual(units.map((unit) => unit.text), [
    'Run the docs check before changing reusable documentation rules.',
  ]);
});

test('Markdown extraction keeps Cyrillic and CJK prose with useful Unicode tokens', () => {
  const units = extractMarkdownUnits({
    file: 'docs/international.md',
    minWords: 6,
    minChars: 20,
    content: `# International documentation

Проверяйте документацию перед изменением общих правил проекта.

更新共享规则之前请检查项目文档以保持内容一致。
`,
  });

  assert.deepEqual(units.map((unit) => unit.text), [
    'Проверяйте документацию перед изменением общих правил проекта.',
    '更新共享规则之前请检查项目文档以保持内容一致。',
  ]);
  assert.deepEqual(units[0].words, [
    'проверяйте',
    'документацию',
    'перед',
    'изменением',
    'общих',
    'правил',
    'проекта',
  ]);
  assert.ok(units[1].words.length >= 6);
  assert.ok(units[1].words.every((word) => /^\p{Letter}$/u.test(word)));
  assert.equal(units[1].words.join(''), '更新共享规则之前请检查项目文档以保持内容一致');
});

test('reference directories are excluded unless explicitly included', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-duplicate-files-'));
  await mkdir(join(root, 'docs'), { recursive: true });
  await mkdir(join(root, 'references'), { recursive: true });
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');
  await writeFile(join(root, 'references/rules.md'), '# Rules\n');

  const withoutReferences = await resolveDuplicateFiles({
    root,
    include: ['**/*.md'],
    exclude: [],
    includeReferences: false,
  });
  const withReferences = await resolveDuplicateFiles({
    root,
    include: ['**/*.md'],
    exclude: [],
    includeReferences: true,
  });

  assert.deepEqual(withoutReferences, ['docs/guide.md']);
  assert.deepEqual(withReferences, ['docs/guide.md', 'references/rules.md']);
});

test('duplicate Markdown globs stay repository-relative and normalize to POSIX paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-safe-globs-'));
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n');

  assert.deepEqual(await resolveDuplicateFiles({
    root,
    include: ['docs\\*.md'],
    exclude: [],
    includeReferences: true,
  }), ['docs/guide.md']);

  await assert.rejects(
    resolveDuplicateFiles({
      root,
      include: ['/tmp/*.md'],
      exclude: [],
      includeReferences: true,
    }),
    /absolute globs are not allowed/i,
  );
  await assert.rejects(
    resolveDuplicateFiles({
      root,
      include: ['../*.md'],
      exclude: [],
      includeReferences: true,
    }),
    /parent-directory traversal/i,
  );
});

test('duplicate Markdown globs allow safe double-dot filenames', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-double-dot-file-'));
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'docs/v1..v2.md'), '# Version range\n');

  assert.deepEqual(await resolveDuplicateFiles({
    root,
    include: ['docs/v1..v2.md'],
    exclude: [],
    includeReferences: true,
  }), ['docs/v1..v2.md']);

  await assert.rejects(
    resolveDuplicateFiles({
      root,
      include: ['docs/../outside.md'],
      exclude: [],
      includeReferences: true,
    }),
    /parent-directory traversal/i,
  );
});

test('duplicate Markdown globs do not traverse directory symlinks', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'docs-validator-symlink-directory-'));
  const root = join(parent, 'repo');
  const outside = join(parent, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'guide.md'), '# Outside\n');
  await symlink(outside, join(root, 'linked-docs'));

  assert.deepEqual(await resolveDuplicateFiles({
    root,
    include: ['**/*.md'],
    exclude: [],
    includeReferences: true,
  }), []);
});

test('static glob prefixes reject escaping directory symlinks before file discovery', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'docs-validator-static-symlink-directory-'));
  const root = join(parent, 'repo');
  const outside = join(parent, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'secret.txt'), 'This file does not match the Markdown glob.\n');
  await symlink(outside, join(root, 'docs'));

  await assert.rejects(
    resolveDuplicateFiles({
      root,
      include: ['docs/**/*.md'],
      exclude: [],
      includeReferences: true,
    }),
    /glob search prefix "docs" resolves outside repository root.*escaping symlink/i,
  );
});

test('matched file symlinks inside the repository remain valid', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-safe-file-symlink-'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'docs/canonical.md'), '# Canonical guide\n');
  await symlink(join('docs', 'canonical.md'), join(root, 'guide.md'));

  assert.deepEqual(await resolveDuplicateFiles({
    root,
    include: ['guide.md'],
    exclude: [],
    includeReferences: true,
  }), ['guide.md']);
});

test('dangling Markdown file symlinks are skipped for broad and exact globs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-dangling-file-symlink-'));
  await symlink('missing.md', join(root, 'dangling.md'));

  for (const include of [['**/*.md'], ['dangling.md']]) {
    assert.deepEqual(await resolveDuplicateFiles({
      root,
      include,
      exclude: [],
      includeReferences: true,
    }), []);
  }
});

test('matched symlinks cannot escape the repository root', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'docs-validator-symlink-escape-'));
  const root = join(parent, 'repo');
  const outside = join(parent, 'outside.md');
  await mkdir(root);
  await writeFile(outside, '# Outside\n\nThis prose must never enter the repository corpus.\n');
  await symlink(outside, join(root, 'escape.md'));

  await assert.rejects(
    resolveDuplicateFiles({
      root,
      include: ['**/*.md'],
      exclude: [],
      includeReferences: true,
    }),
    /resolves outside repository root.*escaping symlink/i,
  );

  const result = spawnSync(process.execPath, [
    cliBin,
    'duplicate-candidates',
    '--root', root,
    '--include', '**/*.md',
    '--format', 'json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /resolves outside repository root.*escaping symlink/i);
});

test('real CLI rejects absolute and parent-traversal candidate globs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-cli-safe-globs-'));
  await writeFile(join(root, 'README.md'), '# Safe repository\n');
  const unsafeArguments = [
    ['--include', join(root, 'README.md'), /absolute globs are not allowed/i],
    ['--focus', '../outside.md', /parent-directory traversal/i],
  ];

  for (const [flag, value, expected] of unsafeArguments) {
    const result = spawnSync(process.execPath, [
      cliBin,
      'duplicate-candidates',
      '--root', root,
      flag, value,
      '--format', 'json',
    ], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, expected);
  }
});

test('candidate IDs and ordering are stable across input order', () => {
  const units = [
    unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('c.md', 'Keep the AGENTS file concise and link to canonical documentation rules.'),
  ];

  const forward = findCandidatePairs(units, { minSimilarity: 0.6 });
  const reversed = findCandidatePairs([...units].reverse(), { minSimilarity: 0.6 });

  assert.deepEqual(forward, reversed);
  assert.equal(new Set(forward.map((candidate) => candidate.id)).size, forward.length);
  assert.ok(forward.every((candidate) => /^DUP-[a-f0-9]{16}$/.test(candidate.id)));
  assert.ok(forward.every((candidate) => candidate.left.file < candidate.right.file));
  assert.ok(forward.every((candidate) => Number.isFinite(candidate.similarity)));
  assert.ok(forward.every((candidate) => !Object.hasOwn(candidate, 'score')));
});

test('candidate IDs do not change when prose moves to another line', () => {
  const original = findCandidatePairs([
    unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.', 2),
    unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.', 4),
  ], { minSimilarity: 0.6 });
  const moved = findCandidatePairs([
    unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.', 20),
    unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.', 40),
  ], { minSimilarity: 0.6 });

  assert.equal(original[0].id, moved[0].id);
});

test('focus files are compared with the full corpus without corpus-only pairs', () => {
  const units = [
    unit('changed.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('docs/a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('docs/b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
  ];

  const candidates = findCandidatePairs(units, {
    focusFiles: ['changed.md'],
    minSimilarity: 0.6,
  });

  assert.deepEqual(candidates.map((candidate) => [candidate.left.file, candidate.right.file]), [
    ['changed.md', 'docs/a.md'],
    ['changed.md', 'docs/b.md'],
  ]);
});

test('an explicit focus with no matching corpus files returns no candidates', () => {
  const candidates = findCandidatePairs([
    unit('docs/a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('docs/b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
  ], {
    focusFiles: [],
    minSimilarity: 0.6,
  });

  assert.deepEqual(candidates, []);
});

test('ignorePairs exclude file pairs symmetrically', () => {
  const definitions = [{
    left: '^fixtures/',
    right: '^docs/',
    reason: 'Fixture prose intentionally repeats the canonical rule.',
  }];
  const ignorePairs = normalizeIgnorePairs(definitions);
  const candidates = findCandidatePairs([
    unit('fixtures/example.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('docs/rules.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('README.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
  ], {
    ignorePairs: definitions,
    minSimilarity: 0.6,
  });

  assert.equal(isIgnoredPair('fixtures/example.md', 'docs/rules.md', ignorePairs), true);
  assert.equal(isIgnoredPair('docs/rules.md', 'fixtures/example.md', ignorePairs), true);
  assert.equal(ignorePairs[0].reason, definitions[0].reason);
  assert.equal(candidates.some((candidate) => (
    candidate.left.file === 'docs/rules.md'
    && candidate.right.file === 'fixtures/example.md'
  )), false);
  assert.equal(candidates.some((candidate) => candidate.left.file === 'README.md'), true);
});

test('ignorePairs reject invalid regex patterns', () => {
  assert.throws(
    () => normalizeIgnorePairs([{ left: '[invalid', right: '^docs/' }]),
    /Invalid duplicate candidate ignore pair regex/,
  );
});

test('ignorePairs reject non-string reasons', () => {
  assert.throws(
    () => normalizeIgnorePairs([{ left: '^fixtures/', right: '^docs/', reason: false }]),
    /reason must be a string/,
  );
});

test('ignorePairs accept only exact plain-object string contracts', () => {
  const invalidEntries = [
    [null, /plain objects/i],
    [[], /plain objects/i],
    [new Date(), /plain objects/i],
    [{ left: '^docs/' }, /non-empty left and right/i],
    [{ left: ' ', right: '^docs/' }, /non-empty left and right/i],
    [{ left: '^docs/', right: 42 }, /non-empty left and right/i],
    [{ left: '^docs/', right: '^rules/', extra: true }, /unsupported key extra/i],
  ];

  for (const [entry, expected] of invalidEntries) {
    assert.throws(() => normalizeIgnorePairs([entry]), expected);
  }

  assert.equal(normalizeIgnorePairs([{
    left: '^docs/',
    right: '^rules/',
    reason: '',
  }])[0].reason, '');
});

test('pagination exposes explicit truncation metadata and a stable cursor', () => {
  const candidates = findCandidatePairs([
    unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('c.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
  ], { minSimilarity: 0.6 });

  const first = paginateCandidates(candidates, { maxCandidates: 2 });
  const second = paginateCandidates(candidates, {
    maxCandidates: 2,
    cursor: first.pagination.nextCursor,
  });

  assert.deepEqual(first.pagination, {
    cursor: null,
    totalCandidates: 3,
    returnedCandidates: 2,
    truncated: true,
    nextCursor: first.candidates[1].id,
  });
  assert.equal(second.candidates.length, 1);
  assert.deepEqual(second.pagination, {
    cursor: first.pagination.nextCursor,
    totalCandidates: 3,
    returnedCandidates: 1,
    truncated: false,
    nextCursor: null,
  });
  assert.throws(
    () => paginateCandidates(candidates, { maxCandidates: 2, cursor: 'DUP-missing' }),
    /cursor.*not found/i,
  );
});

test('bounded page selection preserves candidate order, IDs, totals, and cursors', () => {
  const units = [
    unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('c.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('d.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
  ];
  const all = findCandidatePairs(units, { minSimilarity: 0.6 });
  const expectedFirst = paginateCandidates(all, { maxCandidates: 2 });
  const actualFirst = selectCandidatePage(units, {
    minSimilarity: 0.6,
    maxCandidates: 2,
  });
  const expectedSecond = paginateCandidates(all, {
    maxCandidates: 2,
    cursor: expectedFirst.pagination.nextCursor,
  });
  const actualSecond = selectCandidatePage(units, {
    minSimilarity: 0.6,
    maxCandidates: 2,
    cursor: actualFirst.pagination.nextCursor,
  });

  assert.deepEqual(actualFirst, expectedFirst);
  assert.deepEqual(actualSecond, expectedSecond);
  assert.throws(
    () => selectCandidatePage(units, {
      minSimilarity: 0.6,
      maxCandidates: 2,
      cursor: 'DUP-missing',
    }),
    /not found.*Restart from the first page.*scope may have changed/is,
  );
});

test('comparison estimates honor focus and enforce an actionable hard cap', () => {
  const units = Array.from({ length: 102 }, (_, index) => (
    unit(`docs/${String(index).padStart(4, '0')}.md`, `Distinct documentation unit number ${index}.`)
  ));

  assert.equal(
    estimateCandidateComparisons(units),
    (units.length * (units.length - 1)) / 2,
  );
  assert.equal(
    estimateCandidateComparisons(units, { focusFiles: ['docs/0000.md'] }),
    units.length - 1,
  );
  assert.throws(
    () => selectCandidatePage(units, {
      maxCandidates: 1,
      maxComparisons: 5_000,
      minSimilarity: 1,
    }),
    /more than 5000.*--focus/is,
  );
});

test('real CLI stops oversized same-file comparison scans before scoring', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-cli-comparison-cap-'));
  const paragraphs = Array.from({ length: 2_002 }, (_, index) => (
    `Documentation unit ${index} contains enough distinct words for comparison.`
  ));
  await writeFile(join(root, 'README.md'), `${paragraphs.join('\n\n')}\n`);

  const result = spawnSync(process.execPath, [
    cliBin,
    'duplicate-candidates',
    '--root', root,
    '--include', 'README.md',
    '--include-same-file',
    '--min-words', '4',
    '--min-chars', '20',
    '--max-candidates', '1',
    '--format', 'json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(
    result.stderr,
    new RegExp(`more than ${MAX_CANDIDATE_COMPARISONS} unit pairs.*--focus`, 'is'),
  );
});

test('duplicate-candidates returns zero and emits structured JSON when candidates exist', async () => {
  let stdout = '';
  const code = await runDuplicateCandidates(
    {
      root: '/repo',
      include: ['**/*.md'],
      exclude: [],
      focus: ['changed.md'],
      format: 'json',
      minWords: 4,
      minChars: 20,
      minSimilarity: 0.6,
      maxCandidates: 1,
      includeReferences: false,
      includeSameFile: false,
      ignorePairs: [],
    },
    {
      stdout: { write: (chunk) => { stdout += chunk; } },
      loadMarkdownUnits: async () => ({
        files: ['changed.md', 'docs/a.md', 'docs/b.md'],
        units: [
          unit('changed.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
          unit('docs/a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
          unit('docs/b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
        ],
      }),
      resolveFocusFiles: async () => ['changed.md'],
    },
  );
  const result = JSON.parse(stdout);

  assert.equal(code, 0);
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.corpus.files, ['changed.md', 'docs/a.md', 'docs/b.md']);
  assert.deepEqual(result.focus.files, ['changed.md']);
  assert.equal(result.pagination.totalCandidates, 2);
  assert.equal(result.pagination.returnedCandidates, 1);
  assert.equal(result.pagination.truncated, true);
  assert.match(result.sourceDigest, /^sha256:[a-f0-9]{64}$/);
});

test('source digest binds normalized source units and candidate-selection scope', () => {
  const units = [
    unit('changed.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('docs\\canonical.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
  ];
  const baseScope = {
    focusFiles: ['changed.md'],
    focusExplicit: true,
    includeSameFile: false,
    minSimilarity: 0.72,
    ignorePairs: [],
  };
  const base = sourceDigest(units, baseScope);

  assert.match(base, /^sha256:[a-f0-9]{64}$/);
  assert.notEqual(base, sourceDigest(units, {
    ...baseScope,
    focusFiles: ['changed.md', 'docs/canonical.md'],
    focusExplicit: false,
  }));
  assert.notEqual(base, sourceDigest(units, { ...baseScope, includeSameFile: true }));
  assert.notEqual(base, sourceDigest(units, { ...baseScope, minSimilarity: 0.8 }));
  assert.notEqual(base, sourceDigest(units, {
    ...baseScope,
    ignorePairs: [{ left: '^changed\\.md$', right: '^docs/' }],
  }));
  assert.equal(base, sourceDigest([
    units[0],
    { ...units[1], file: 'docs/canonical.md' },
  ], baseScope));
});

test('text and JSON formatters expose locations, signals, and truncation state', () => {
  const result = sampleResult();
  const text = formatDuplicateCandidatesText(result);
  const json = JSON.parse(formatDuplicateCandidatesJson(result));

  assert.match(text, /Documentation duplicate candidates/);
  assert.match(text, /Returned candidates: 1 of 2/);
  assert.match(text, /Truncated: yes/);
  assert.match(text, /changed\.md:2/);
  assert.match(text, /normalized exact match/);
  assert.match(text, /similarity=1\.000/);
  assert.equal(json.candidates[0].left.file, 'changed.md');
  assert.equal(json.pagination.nextCursor, 'DUP-0123456789abcdef');
});

test('duplicateCandidates config and CLI flags resolve without AI settings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-duplicate-config-'));
  await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
    docs: {
      include: ['docs/**/*.md'],
      duplicateCandidates: {
        minSimilarity: 0.65,
        maxCandidates: 25,
        ignorePairs: [{ left: '^fixtures/', right: '^docs/', reason: 'Fixture overlap.' }],
      },
    },
  }));

  const options = await resolveDuplicateCandidateOptions(parseArgs([
    'duplicate-candidates',
    '--root', root,
    '--include', '*.md',
    '--focus', 'README.md',
    '--min-similarity', '0.8',
    '--max-candidates', '10',
    '--format', 'json',
  ]));

  assert.deepEqual(options.include, ['*.md']);
  assert.deepEqual(options.focus, ['README.md']);
  assert.equal(options.minSimilarity, 0.8);
  assert.equal(options.maxCandidates, 10);
  assert.equal(options.format, 'json');
  assert.deepEqual(options.ignorePairs, [
    { left: '^fixtures/', right: '^docs/', reason: 'Fixture overlap.' },
  ]);
  assert.equal('model' in options, false);
  assert.equal('reasoningEffort' in options, false);
  assert.equal('codexBin' in options, false);
});

test('stale AI config fails with actionable migration errors', async () => {
  const cases = [
    [{ docs: { duplicates: { model: 'gpt-5' } } }, /docs\.duplicates.*docs\.duplicateCandidates/i],
    [{ docs: { style: { model: 'gpt-5' } } }, /docs\.style.*agent-doc-rules skill/i],
    [{ docs: { duplicateCandidates: { codexBin: 'codex' } } }, /unsupported.*codexBin.*remove/i],
    [{ docs: { duplicateCandidates: { model: 'gpt-5' } } }, /unsupported.*model.*remove/i],
    [{ docs: { duplicateCandidates: { reasoningEffort: 'low' } } }, /unsupported.*reasoningEffort.*remove/i],
    [{ docs: { duplicateCandidates: { minScore: 0.7 } } }, /minScore.*minSimilarity/i],
    [{ docs: { duplicateCandidates: { focus: ['README.md'] } } }, /focus.*--focus/i],
  ];

  for (const [config, expected] of cases) {
    const root = await mkdtemp(join(tmpdir(), 'docs-validator-stale-config-'));
    await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify(config));

    await assert.rejects(
      resolveDuplicateCandidateOptions({ command: 'duplicate-candidates', root }),
      expected,
    );
  }
});

test('duplicateCandidates config rejects invalid public field types', async () => {
  const cases = [
    [{ include: 'docs/**/*.md' }, /include.*array/i],
    [{ exclude: 'dist/**' }, /exclude.*array/i],
    [{ includeReferences: 'false' }, /includeReferences.*boolean/i],
    [{ includeSameFile: 1 }, /includeSameFile.*boolean/i],
    [{ minSimilarity: '0.7' }, /minSimilarity.*number/i],
    [{ minWords: 4.5 }, /minWords.*positive integer/i],
    [{ minChars: 0 }, /minChars.*positive integer/i],
    [{ maxCandidates: -1 }, /maxCandidates.*positive integer/i],
    [{ ignorePairs: {} }, /ignorePairs.*array/i],
  ];

  for (const [duplicateCandidates, expected] of cases) {
    const root = await mkdtemp(join(tmpdir(), 'docs-validator-invalid-fields-'));
    await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
      docs: { duplicateCandidates },
    }));

    await assert.rejects(
      resolveDuplicateCandidateOptions({ command: 'duplicate-candidates', root }),
      expected,
    );
  }
});

test('duplicateCandidates config rejects malformed ignorePairs entries', async () => {
  const cases = [
    [{ left: '^docs/' }, /non-empty left and right/i],
    [{ left: '', right: '^rules/' }, /non-empty left and right/i],
    [{ left: '^docs/', right: '^rules/', reason: true }, /reason must be a string/i],
    [{ left: '^docs/', right: '^rules/', unknown: 'value' }, /unsupported key unknown/i],
  ];

  for (const [entry, expected] of cases) {
    const root = await mkdtemp(join(tmpdir(), 'docs-validator-invalid-ignore-pair-'));
    await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
      docs: { duplicateCandidates: { ignorePairs: [entry] } },
    }));

    await assert.rejects(
      resolveDuplicateCandidateOptions({ command: 'duplicate-candidates', root }),
      expected,
    );
  }
});

test('obsolete CLI flags are not part of the command contract', () => {
  assert.throws(
    () => parseArgs(['duplicate-candidates', '--model', 'gpt-5']),
    /Unknown option: --model/,
  );
  assert.throws(
    () => parseArgs(['duplicate-candidates', '--codex-bin', 'codex']),
    /Unknown option: --codex-bin/,
  );
  assert.throws(
    () => parseArgs(['duplicate-candidates', '--min-score', '0.7']),
    /--min-score.*--min-similarity/i,
  );
});

test('CLI reports configuration errors with a nonzero exit code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-invalid-config-'));
  await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
    docs: { duplicateCandidates: { model: 'gpt-5' } },
  }));

  const result = spawnSync(process.execPath, [
    cliBin,
    'duplicate-candidates',
    '--root', root,
    '--format', 'json',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /model.*remove/i);
  assert.equal(result.stdout, '');
});

test('CLI compares explicit focus files with the full Markdown corpus', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-cli-candidates-'));
  await mkdir(join(root, 'docs'), { recursive: true });
  const repeated = 'Keep AGENTS.md short and link to canonical documentation rules.\n';
  await writeFile(join(root, 'changed.md'), repeated);
  await writeFile(join(root, 'docs/canonical.md'), repeated);
  await writeFile(join(root, 'docs/unrelated.md'), 'Document release versions in the changelog.\n');

  const result = spawnSync(process.execPath, [
    cliBin,
    'duplicate-candidates',
    '--root', root,
    '--include', '**/*.md',
    '--focus', 'changed.md',
    '--min-similarity', '0.6',
    '--min-words', '4',
    '--min-chars', '20',
    '--format', 'json',
  ], { encoding: 'utf8' });
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(output.focus.files, ['changed.md']);
  assert.equal(output.candidates.length, 1);
  assert.deepEqual(
    [output.candidates[0].left.file, output.candidates[0].right.file],
    ['changed.md', 'docs/canonical.md'],
  );
});

test('runCommand dispatches duplicate-candidates independently of AI tooling', async () => {
  let called = false;
  const code = await runCommand('duplicate-candidates', {}, {
    runDuplicateCandidates: async () => {
      called = true;
      return 0;
    },
  });

  assert.equal(code, 0);
  assert.equal(called, true);
});

function unit(file, text, line = 1) {
  return {
    id: `${file}:${line}:1`,
    file,
    line,
    text,
    normalized: text.toLowerCase().replace(/[.`]/g, ''),
    words: text.toLowerCase().replace(/[.`]/g, '').split(/\s+/),
  };
}

function sampleResult() {
  return {
    schemaVersion: 1,
    sourceDigest: `sha256:${'a'.repeat(64)}`,
    corpus: { files: ['changed.md', 'docs/rules.md'], units: 2 },
    focus: { files: ['changed.md'], units: 1, explicit: true },
    candidates: [{
      id: 'DUP-0123456789abcdef',
      similarity: 1,
      signal: 'normalized exact match',
      left: { file: 'changed.md', line: 2, text: 'Use the canonical rule.' },
      right: { file: 'docs/rules.md', line: 4, text: 'Use the canonical rule.' },
    }],
    pagination: {
      cursor: null,
      totalCandidates: 2,
      returnedCandidates: 1,
      truncated: true,
      nextCursor: 'DUP-0123456789abcdef',
    },
  };
}
