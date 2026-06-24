import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { findCandidatePairs } from '../src/candidates.mjs';
import { checkDuplicates, normalizeReviews } from '../src/check.mjs';
import { buildCodexPrompt } from '../src/codex.mjs';
import { resolveDuplicateOptions } from '../src/config.mjs';
import {
  extractMarkdownUnits,
  normalizeForDuplicateCheck,
  resolveDuplicateFiles,
} from '../src/markdown.mjs';
import { parseArgs } from '../src/cli.mjs';

test('Markdown extraction skips code blocks and short noise', () => {
  const units = extractMarkdownUnits({
    file: 'README.md',
    minWords: 4,
    minChars: 20,
    content: `# Docs

Run the docs check before changing reusable documentation rules.

\`\`\`md
Run the docs check before changing reusable documentation rules.
\`\`\`

Tiny.
`,
  });

  assert.equal(units.length, 1);
  assert.equal(units[0].text, 'Run the docs check before changing reusable documentation rules.');
});

test('references are skipped by default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-duplicates-references-'));
  await mkdir(join(root, 'references'), { recursive: true });
  await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'references/rules.md'), '# Rules\n');
  await writeFile(join(root, 'docs/rules.md'), '# Rules\n');

  const files = await resolveDuplicateFiles({
    root,
    include: ['**/*.md'],
    exclude: [],
    includeReferences: false,
  });

  assert.deepEqual(files, ['docs/rules.md']);
});

test('include-references includes reference docs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-duplicates-include-references-'));
  await mkdir(join(root, 'references'), { recursive: true });
  await writeFile(join(root, 'references/rules.md'), '# Rules\n');

  const files = await resolveDuplicateFiles({
    root,
    include: ['**/*.md'],
    exclude: [],
    includeReferences: true,
  });

  assert.deepEqual(files, ['references/rules.md']);
});

test('deterministic prefilter finds exact and near duplicates', () => {
  const units = [
    unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
    unit('c.md', 'Keep the AGENTS file concise and link to the canonical docs rules.'),
    unit('d.md', 'This sentence talks about release trains and version tags.'),
  ];

  const candidates = findCandidatePairs(units, {
    warnScore: 0.6,
    maxCandidates: 10,
  });

  assert.ok(candidates.some((candidate) => candidate.left.file === 'a.md' && candidate.right.file === 'b.md'));
  assert.ok(candidates.some((candidate) => candidate.left.file === 'a.md' && candidate.right.file === 'c.md'));
});

test('Codex prompt contains only candidate pair text', () => {
  const prompt = buildCodexPrompt([
    {
      id: 'DUP-1',
      score: 1,
      reason: 'normalized exact match',
      left: { file: 'a.md', line: 1, text: 'Duplicate text only.' },
      right: { file: 'b.md', line: 1, text: 'Duplicate text only.' },
    },
  ]);

  assert.match(prompt, /Duplicate text only/);
  assert.doesNotMatch(prompt, /secret non-candidate text/);
});

test('structured Codex JSON maps to fail, warn, and ok', () => {
  const candidates = [
    candidate('DUP-1'),
    candidate('DUP-2'),
    candidate('DUP-3'),
  ];
  const reviews = normalizeReviews({
    candidates,
    options: { warnScore: 0.7, failScore: 0.9 },
    rawResult: {
      matches: [
        { id: 'DUP-1', score: 0.95, status: 'fail', reason: 'same rule' },
        { id: 'DUP-2', score: 0.75, status: 'warn', reason: 'similar wording' },
        { id: 'DUP-3', score: 0.2, status: 'ok', reason: 'different intent' },
      ],
    },
  });

  assert.deepEqual(reviews.map((review) => review.status), ['fail', 'warn', 'ok']);
});

test('Codex status controls severity even with a high duplicate score', () => {
  const reviews = normalizeReviews({
    candidates: [candidate('DUP-1')],
    options: { warnScore: 0.7, failScore: 0.9 },
    rawResult: {
      matches: [
        { id: 'DUP-1', score: 1, status: 'warn', reason: 'intentional package README overlap' },
      ],
    },
  });

  assert.equal(reviews[0].status, 'warn');
});

test('fail findings return non-zero exit code', async () => {
  const result = await checkDuplicates(
    {
      warnScore: 0.7,
      failScore: 0.9,
      maxCandidates: 10,
    },
    {
      loadMarkdownUnits: async () => ({
        files: ['a.md', 'b.md'],
        units: [
          unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
          unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
        ],
      }),
      classifyCandidates: async () => ({
        matches: [{ id: 'DUP-1', score: 0.95, status: 'fail', reason: 'same rule' }],
      }),
    },
  );

  assert.equal(result.code, 1);
});

test('warning-only findings return zero exit code', async () => {
  const result = await checkDuplicates(
    {
      warnScore: 0.7,
      failScore: 0.9,
      maxCandidates: 10,
    },
    {
      loadMarkdownUnits: async () => ({
        files: ['a.md', 'b.md'],
        units: [
          unit('a.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
          unit('b.md', 'Keep AGENTS.md short and link to canonical documentation rules.'),
        ],
      }),
      classifyCandidates: async () => ({
        matches: [{ id: 'DUP-1', score: 0.8, status: 'warn', reason: 'similar rule' }],
      }),
    },
  );

  assert.equal(result.code, 0);
});

test('CLI flags override config defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-duplicates-config-'));
  await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
    docs: {
      include: ['docs/**/*.md'],
      duplicates: {
        model: 'configured-model',
        warnScore: 0.5,
      },
    },
  }));

  const options = await resolveDuplicateOptions({
    ...parseArgs(['check', '--root', root, '--include', '*.md', '--model', 'flag-model', '--warn-score', '0.8']),
  });

  assert.deepEqual(options.include, ['*.md']);
  assert.equal(options.model, 'flag-model');
  assert.equal(options.warnScore, 0.8);
});

function unit(file, text) {
  return {
    file,
    line: 1,
    text,
    normalized: normalizeForDuplicateCheck(text),
    words: normalizeForDuplicateCheck(text).split(' '),
  };
}

function candidate(id) {
  return {
    id,
    score: 1,
    reason: 'test',
    left: { file: `${id}-a.md`, line: 1, text: 'left text' },
    right: { file: `${id}-b.md`, line: 1, text: 'right text' },
  };
}
