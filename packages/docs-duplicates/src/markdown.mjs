import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fastGlob from 'fast-glob';
import { toString } from 'mdast-util-to-string';
import { split } from 'sentence-splitter';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

export async function resolveDuplicateFiles({ root, include, exclude, includeReferences = false }) {
  const files = await fastGlob(include, {
    cwd: root,
    dot: true,
    ignore: expandExcludePatterns(exclude),
    onlyFiles: true,
    unique: true,
  });

  return files
    .filter((file) => file.endsWith('.md'))
    .filter((file) => includeReferences || !hasPathSegment(file, 'references'))
    .sort((left, right) => left.localeCompare(right));
}

export async function loadMarkdownUnits(options) {
  const files = await resolveDuplicateFiles(options);
  const units = [];

  for (const file of files) {
    const content = await readFile(join(options.root, file), 'utf8');
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
  const tree = unified().use(remarkParse).parse(content);
  const units = [];

  visit(tree, ['heading', 'paragraph'], (node) => {
    if (node.type === 'paragraph' && isMarkdownTableBlock(sliceNodeContent(content, node))) {
      return;
    }

    const text = normalizeWhitespace(toString(node));

    for (const sentence of splitIntoUnits(text)) {
      const normalized = normalizeForDuplicateCheck(sentence);
      const words = normalized.split(' ').filter(Boolean);

      if (isUsefulUnit({ text: sentence, normalized, words, minWords, minChars })) {
        units.push({
          id: `${file}:${node.position?.start?.line ?? 1}:${units.length + 1}`,
          file,
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

export function normalizeForDuplicateCheck(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[`*_~[\](){}#>.,:;!?'"“”‘’]/g, '')
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

  const alphaNumericCount = (text.match(/[a-z0-9]/gi) ?? []).length;
  return alphaNumericCount / Math.max(text.length, 1) >= 0.45;
}

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

  const allPipeRows = lines.every((line) => line.startsWith('|') && line.endsWith('|') && line.split('|').length >= 4);
  if (!allPipeRows) {
    return false;
  }

  return lines.some((line) => /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|$/.test(line));
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function hasPathSegment(file, segment) {
  return file.split(/[\\/]/).includes(segment);
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
