import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { findCandidatePairs } from '../src/candidates.mjs';
import { checkDuplicates, normalizeReviews } from '../src/check.mjs';
import { buildCodexPrompt, buildStylePrompt } from '../src/codex.mjs';
import { resolveDuplicateOptions, resolveStyleOptions } from '../src/config.mjs';
import {
  extractMarkdownUnits,
  normalizeForDuplicateCheck,
  resolveDuplicateFiles,
} from '../src/markdown.mjs';
import { parseArgs } from '../src/cli.mjs';
import { checkStyle, normalizeStyleFindings } from '../src/style.mjs';

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

test('Markdown extraction skips pipe tables', () => {
  const units = extractMarkdownUnits({
    file: 'README.md',
    minWords: 4,
    minChars: 20,
    content: `# Docs

| Task | Command |
| --- | --- |
| Run AI sentence-level style review | \`corepack pnpm run docs:style\` |

Use direct sentences outside tables for prose review.
`,
  });

  assert.deepEqual(units.map((unit) => unit.text), [
    'Use direct sentences outside tables for prose review.',
  ]);
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

test('style CLI flags override config defaults', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-style-config-'));
  await writeFile(join(root, 'agent-doc-rules.config.json'), JSON.stringify({
    docs: {
      include: ['docs/**/*.md'],
      style: {
        model: 'configured-model',
        maxUnits: 10,
      },
    },
  }));

  const options = await resolveStyleOptions({
    ...parseArgs(['style', '--root', root, '--include', '*.md', '--model', 'flag-model', '--max-units', '3']),
  });

  assert.deepEqual(options.include, ['*.md']);
  assert.equal(options.model, 'flag-model');
  assert.equal(options.maxUnits, 3);
});

test('style prompt contains only reviewed sentence units', () => {
  const prompt = buildStylePrompt([
    {
      id: 'README.md:2:1',
      file: 'README.md',
      line: 2,
      text: 'Run the cleanup checklist before release.',
    },
  ]);

  assert.match(prompt, /Run the cleanup checklist before release/);
  assert.doesNotMatch(prompt, /secret non-reviewed text/);
});

test('AI style findings return non-zero only for fail', async () => {
  const result = await checkStyle(
    {
      maxUnits: 10,
    },
    {
      loadMarkdownUnits: async () => ({
        files: ['README.md'],
        units: [
          unit('README.md', 'Run the unclear magic workflow before release.'),
        ],
      }),
      reviewStyle: async () => ({
        findings: [
          {
            id: 'README.md:1:1',
            status: 'fail',
            category: 'idiom',
            issue: 'The workflow name is unclear.',
            suggestion: 'Use a direct workflow name.',
            confidence: 0.9,
          },
        ],
      }),
    },
  );

  assert.equal(result.code, 1);
  assert.match(result.report, /Docs AI style review/);
  assert.match(result.report, /The workflow name is unclear/);
});

test('AI style warning-only findings return zero', async () => {
  const result = await checkStyle(
    {
      maxUnits: 10,
    },
    {
      loadMarkdownUnits: async () => ({
        files: ['README.md'],
        units: [
          unit('README.md', 'This sentence is clear but could be shorter.'),
        ],
      }),
      reviewStyle: async () => ({
        findings: [
          {
            id: 'README.md:1:1',
            status: 'warn',
            category: 'too-long',
            issue: 'The sentence could be shorter.',
            suggestion: 'Split it into two sentences.',
            confidence: 0.7,
          },
        ],
      }),
    },
  );

  assert.equal(result.code, 0);
  assert.match(result.report, /Summary: 0 fail, 1 warn/);
});

test('style findings ignore ok results and attach locations', () => {
  const findings = normalizeStyleFindings({
    reviewUnits: [unit('README.md', 'Use direct workflow names.')],
    rawResult: {
      findings: [
        {
          id: 'README.md:1:1',
          status: 'ok',
          category: 'ok',
          issue: 'ok',
          suggestion: 'ok',
          confidence: 1,
        },
        {
          id: 'README.md:1:1',
          status: 'warn',
          category: 'vague',
          issue: 'Vague wording.',
          suggestion: 'Use a specific noun.',
          confidence: 0.8,
        },
      ],
    },
  });

  assert.deepEqual(findings.map((finding) => finding.status), ['warn']);
  assert.equal(findings[0].file, 'README.md');
});

function unit(file, text) {
  return {
    id: `${file}:1:1`,
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
