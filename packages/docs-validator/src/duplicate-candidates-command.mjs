import { createHash } from 'node:crypto';
import { normalizeIgnorePairs, selectCandidatePage } from './duplicate-candidates.mjs';
import {
  loadMarkdownUnits,
  normalizeRepoRelativePath,
  resolveFocusFiles,
} from './duplicate-markdown.mjs';

export async function runDuplicateCandidates(options, deps = {}) {
  const loadUnits = deps.loadMarkdownUnits ?? loadMarkdownUnits;
  const findFocus = deps.resolveFocusFiles ?? resolveFocusFiles;
  const selectPage = deps.selectCandidatePage ?? selectCandidatePage;
  const stdout = deps.stdout ?? process.stdout;
  const loaded = await loadUnits(options);
  const files = normalizeFileList(loaded.files, 'Duplicate candidate corpus file');
  const units = loaded.units;
  const focusPatterns = options.focus ?? [];
  const focusFiles = normalizeFileList(await findFocus({
    root: options.root,
    focus: focusPatterns,
    exclude: options.exclude,
    includeReferences: options.includeReferences,
    corpusFiles: files,
  }), 'Duplicate candidate focus file');
  const page = selectPage(units, {
    focusFiles: focusPatterns.length > 0 ? focusFiles : null,
    includeSameFile: options.includeSameFile,
    ignorePairs: options.ignorePairs,
    minSimilarity: options.minSimilarity,
    maxCandidates: options.maxCandidates,
    cursor: options.cursor,
  });
  const focusSet = new Set(focusFiles);
  const result = {
    schemaVersion: 1,
    sourceDigest: sourceDigest(units, {
      focusFiles,
      focusExplicit: focusPatterns.length > 0,
      includeSameFile: options.includeSameFile,
      minSimilarity: options.minSimilarity,
      ignorePairs: options.ignorePairs,
    }),
    corpus: {
      files,
      units: units.length,
    },
    focus: {
      files: focusFiles,
      units: units.filter((unit) => (
        focusSet.has(normalizeRepoRelativePath(unit.file, 'Duplicate candidate unit file'))
      )).length,
      explicit: focusPatterns.length > 0,
    },
    candidates: page.candidates,
    pagination: page.pagination,
  };

  stdout.write(options.format === 'json'
    ? formatDuplicateCandidatesJson(result)
    : formatDuplicateCandidatesText(result));

  return 0;
}

export function formatDuplicateCandidatesJson(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function formatDuplicateCandidatesText(result) {
  const lines = [
    'Documentation duplicate candidates',
    `Corpus files: ${result.corpus.files.length}`,
    `Focus files: ${result.focus.files.length}${result.focus.explicit ? ' (explicit)' : ' (full corpus)'}`,
    `Text units: ${result.corpus.units}`,
    `Returned candidates: ${result.pagination.returnedCandidates} of ${result.pagination.totalCandidates}`,
    `Truncated: ${result.pagination.truncated ? 'yes' : 'no'}`,
    `Source digest: ${result.sourceDigest}`,
  ];

  for (const candidate of result.candidates) {
    lines.push('');
    lines.push(
      `[${candidate.id}] similarity=${candidate.similarity.toFixed(3)} signal=${candidate.signal}`,
    );
    lines.push(`${candidate.left.file}:${candidate.left.line}`);
    lines.push(candidate.left.text);
    lines.push(`${candidate.right.file}:${candidate.right.line}`);
    lines.push(candidate.right.text);
  }

  if (result.pagination.nextCursor) {
    lines.push('');
    lines.push(`Next cursor: ${result.pagination.nextCursor}`);
  }

  return `${lines.join('\n')}\n`;
}

export function sourceDigest(units, {
  focusFiles,
  focusExplicit,
  includeSameFile,
  minSimilarity,
  ignorePairs,
}) {
  const sourceUnits = [...units]
    .map((unit) => ({
      ...unit,
      file: normalizeRepoRelativePath(unit.file, 'Duplicate candidate unit file'),
    }))
    .sort((left, right) => (
      compareText(left.file, right.file)
      || left.line - right.line
      || compareText(left.text, right.text)
    ))
    .map((unit) => [unit.file, unit.line, unit.text]);
  const normalizedIgnorePairs = normalizeIgnorePairs(ignorePairs)
    .map((entry) => [entry.left.source, entry.right.source].sort(compareText))
    .map((entry) => entry.join('\0'));
  const scope = {
    focusFiles: normalizeFileList(focusFiles, 'Duplicate candidate focus file'),
    focusExplicit: Boolean(focusExplicit),
    includeSameFile: Boolean(includeSameFile),
    minSimilarity,
    ignorePairs: [...new Set(normalizedIgnorePairs)].sort(compareText),
  };
  const content = JSON.stringify({ sourceUnits, scope });
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function normalizeFileList(files, label) {
  return [...new Set(files.map((file) => normalizeRepoRelativePath(file, label)))].sort(compareText);
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}
