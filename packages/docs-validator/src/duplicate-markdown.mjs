import { readFile, realpath, stat } from 'node:fs/promises';
import {
  isAbsolute,
  posix,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path';
import fastGlob from 'fast-glob';
import { toString } from 'mdast-util-to-string';
import { split } from 'sentence-splitter';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export async function resolveDuplicateFiles({ root, include, exclude, includeReferences = false }) {
  const entries = await resolveDuplicateFileEntries({
    root,
    include,
    exclude,
    includeReferences,
  });

  return entries.map((entry) => entry.file);
}

async function resolveDuplicateFileEntries({
  root,
  include,
  exclude,
  includeReferences = false,
}) {
  validateRepoRelativeGlobs(include, 'include');
  validateRepoRelativeGlobs(exclude, 'exclude');

  const realRoot = await realpath(resolve(root));
  const normalizedInclude = include.map(normalizeGlobPattern);
  const normalizedExclude = exclude.map(normalizeGlobPattern);
  await validateGlobSearchPrefixes(realRoot, normalizedInclude);
  const files = await fastGlob(normalizedInclude, {
    cwd: realRoot,
    dot: true,
    ignore: expandExcludePatterns(normalizedExclude),
    // Match file symlinks for containment checks without traversing symlinked directories.
    onlyFiles: false,
    followSymbolicLinks: false,
    unique: true,
  });
  const entries = [];

  for (const matchedFile of files) {
    const file = normalizeRepoRelativePath(matchedFile, 'Matched Markdown path');

    if (!file.endsWith('.md') || (!includeReferences && hasPathSegment(file, 'references'))) {
      continue;
    }

    let verifiedRealPath;

    try {
      verifiedRealPath = await realpath(resolve(realRoot, ...file.split('/')));
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }

      throw error;
    }

    if (!isPathInside(realRoot, verifiedRealPath)) {
      throw new Error(
        `Matched Markdown path ${JSON.stringify(file)} resolves outside repository root `
        + `${JSON.stringify(realRoot)}. Remove the path or replace the escaping symlink.`,
      );
    }

    if (!(await stat(verifiedRealPath)).isFile()) {
      continue;
    }

    entries.push({ file, realPath: verifiedRealPath });
  }

  return [...new Map(entries.map((entry) => [entry.file, entry])).values()]
    .sort((left, right) => compareText(left.file, right.file));
}

function normalizeGlobPattern(pattern) {
  return pattern.replaceAll('\\', '/').replace(/^\.\//, '');
}

async function validateGlobSearchPrefixes(realRoot, patterns) {
  const bases = fastGlob.generateTasks(patterns)
    .map((task) => normalizeGlobPattern(task.base))
    .filter((base) => base !== '.' && base !== '');

  for (const base of new Set(bases)) {
    const normalizedBase = normalizeRepoRelativePath(base, 'Glob search prefix');
    const segments = normalizedBase.split('/');

    for (let length = 1; length <= segments.length; length += 1) {
      const prefix = segments.slice(0, length).join('/');
      let verifiedPrefix;

      try {
        verifiedPrefix = await realpath(resolve(realRoot, ...segments.slice(0, length)));
      } catch (error) {
        if (isMissingPathError(error)) {
          break;
        }

        throw error;
      }

      if (!isPathInside(realRoot, verifiedPrefix)) {
        throw new Error(
          `Glob search prefix ${JSON.stringify(prefix)} resolves outside repository root `
          + `${JSON.stringify(realRoot)}. Remove the path or replace the escaping symlink.`,
        );
      }
    }
  }
}

function isMissingPathError(error) {
  return error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
}

export async function resolveFocusFiles({
  root,
  focus = [],
  exclude,
  includeReferences = false,
  corpusFiles,
}) {
  if (focus.length === 0) {
    return [...corpusFiles];
  }

  const matchedFiles = await resolveDuplicateFiles({
    root,
    include: focus,
    exclude,
    includeReferences,
  });
  const corpus = new Set(corpusFiles);

  return matchedFiles.filter((file) => corpus.has(file));
}

export async function loadMarkdownUnits(options) {
  const entries = await resolveDuplicateFileEntries(options);
  const files = entries.map((entry) => entry.file);
  const units = [];

  for (const { file, realPath: verifiedRealPath } of entries) {
    const content = await readFile(verifiedRealPath, 'utf8');
    units.push(...extractMarkdownUnits({
      file,
      content,
      minWords: options.minWords,
      minChars: options.minChars,
    }));
  }

  return { files, units };
}

export function extractMarkdownUnits({ file, content, minWords = 6, minChars = 40 }) {
  const normalizedFile = normalizeRepoRelativePath(file, 'Markdown file');
  const tree = unified().use(remarkParse).parse(content);
  const units = [];

  visit(tree, ['heading', 'paragraph'], (node) => {
    if (node.type === 'paragraph' && isMarkdownTableBlock(sliceNodeContent(content, node))) {
      return;
    }

    const text = normalizeWhitespace(toString(node));

    for (const sentence of splitIntoUnits(text)) {
      const normalized = normalizeForDuplicateCheck(sentence);
      const words = tokenizeNormalizedText(normalized);

      if (isUsefulUnit({ text: sentence, normalized, words, minWords, minChars })) {
        units.push({
          id: `${normalizedFile}:${node.position?.start?.line ?? 1}:${units.length + 1}`,
          file: normalizedFile,
          line: node.position?.start?.line ?? 1,
          text: sentence,
          normalized,
          words,
        });
      }
    }
  });

  return units;
}

export function validateRepoRelativeGlobs(patterns, label = 'glob') {
  if (!Array.isArray(patterns)) {
    throw new Error(`${label} values must be an array of repository-relative globs.`);
  }

  for (const pattern of patterns) {
    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new Error(`${label} values must be non-empty repository-relative globs.`);
    }

    const normalizedSeparators = pattern.replaceAll('\\', '/');
    const pathPattern = normalizedSeparators.replace(/^!+/, '');

    if (
      pathPattern.includes('\0')
      || posix.isAbsolute(pathPattern)
      || win32.isAbsolute(pattern.replace(/^!+/, ''))
    ) {
      throw new Error(
        `${label} glob ${JSON.stringify(pattern)} must be repository-relative; absolute globs are not allowed.`,
      );
    }

    if (pathPattern.split('/').some((segment) => segment === '..')) {
      throw new Error(
        `${label} glob ${JSON.stringify(pattern)} must not contain parent-directory traversal.`,
      );
    }
  }
}

export function normalizeRepoRelativePath(file, label = 'path') {
  if (typeof file !== 'string' || file.trim().length === 0 || file.includes('\0')) {
    throw new Error(`${label} must be a non-empty repository-relative path.`);
  }

  const normalizedSeparators = file.replaceAll('\\', '/');

  if (posix.isAbsolute(normalizedSeparators) || win32.isAbsolute(file) || isAbsolute(file)) {
    throw new Error(`${label} ${JSON.stringify(file)} must be repository-relative.`);
  }

  if (normalizedSeparators.split('/').some((segment) => segment === '..')) {
    throw new Error(`${label} ${JSON.stringify(file)} must not traverse outside the repository.`);
  }

  const normalized = posix.normalize(normalizedSeparators).replace(/^\.\//, '');

  if (normalized === '.' || normalized.startsWith('../')) {
    throw new Error(`${label} ${JSON.stringify(file)} must name a file inside the repository.`);
  }

  return normalized;
}

export function normalizeForDuplicateCheck(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[`*_~[\](){}#>.,:;!?\'"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoUnits(text) {
  const sentences = split(text)
    .filter((node) => node.type === 'Sentence')
    .map((node) => normalizeWhitespace(node.raw))
    .filter(Boolean);

  return sentences.length > 0 ? sentences : [text];
}

function isUsefulUnit({ text, normalized, words, minWords, minChars }) {
  if (normalized.length < minChars || words.length < minWords) {
    return false;
  }

  const alphaNumericCount = (text.match(/[\p{Letter}\p{Number}]/gu) ?? []).length;
  return alphaNumericCount / Math.max(text.length, 1) >= 0.45;
}

function tokenizeNormalizedText(text) {
  return text.split(' ').flatMap((token) => {
    if (!CJK_CHARACTER_PATTERN.test(token)) {
      return token ? [token] : [];
    }

    return token.split(CJK_SPLIT_PATTERN).flatMap((part) => {
      if (CJK_CHARACTER_PATTERN.test(part)) {
        return [part];
      }

      return part.match(UNICODE_WORD_PATTERN) ?? [];
    });
  });
}

const CJK_SCRIPT_SOURCE = [
  String.raw`\p{Script=Han}`,
  String.raw`\p{Script=Hiragana}`,
  String.raw`\p{Script=Katakana}`,
  String.raw`\p{Script=Hangul}`,
].join('');
const CJK_CHARACTER_PATTERN = new RegExp(`[${CJK_SCRIPT_SOURCE}]`, 'u');
const CJK_SPLIT_PATTERN = new RegExp(`([${CJK_SCRIPT_SOURCE}])`, 'gu');
const UNICODE_WORD_PATTERN = /[\p{Letter}\p{Mark}\p{Number}]+/gu;

function sliceNodeContent(content, node) {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;

  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return '';
  }

  return content.slice(start, end);
}

function isMarkdownTableBlock(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return false;
  }

  const allPipeRows = lines.every((line) => (
    line.startsWith('|') && line.endsWith('|') && line.split('|').length >= 4
  ));

  if (!allPipeRows) {
    return false;
  }

  return lines.some((line) => /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line));
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function hasPathSegment(file, segment) {
  return file.split('/').includes(segment);
}

function expandExcludePatterns(exclude) {
  const expanded = [];

  for (const pattern of exclude) {
    expanded.push(pattern);

    if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
      expanded.push(`**/${pattern}`);
    }
  }

  return [...new Set(expanded)];
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

function isPathInside(root, target) {
  const pathFromRoot = relative(root, target);
  return pathFromRoot !== '..'
    && !pathFromRoot.startsWith(`..${sep}`)
    && !isAbsolute(pathFromRoot);
}
