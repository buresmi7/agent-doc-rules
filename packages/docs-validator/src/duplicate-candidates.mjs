import { createHash } from 'node:crypto';
import { normalizeRepoRelativePath } from './duplicate-markdown.mjs';

export const MAX_CANDIDATE_COMPARISONS = 2_000_000;

export function findCandidatePairs(units, options = {}) {
  const context = createCandidateContext(units, options);
  const candidates = [];

  scanCandidateMatches(context, (candidate) => candidates.push(candidate));
  return candidates.sort(compareCandidates);
}

export function selectCandidatePage(units, {
  cursor,
  maxCandidates,
  maxComparisons = MAX_CANDIDATE_COMPARISONS,
  ...candidateOptions
} = {}) {
  if (!Number.isInteger(maxCandidates) || maxCandidates <= 0) {
    throw new Error('maxCandidates must be a positive integer.');
  }

  if (!Number.isInteger(maxComparisons) || maxComparisons <= 0) {
    throw new Error('maxComparisons must be a positive integer.');
  }

  const context = createCandidateContext(units, candidateOptions);
  const comparisonEstimate = estimateContextComparisons(context, maxComparisons);

  if (comparisonEstimate > maxComparisons) {
    throw new Error(
      `Duplicate candidate scan would compare more than ${maxComparisons} unit pairs. `
      + 'Narrow the corpus with --include or --exclude, raise --min-words or '
      + '--min-chars, or pass --focus for the files changed in this review.',
    );
  }

  let totalCandidates = 0;
  const selected = [];
  const cursorCandidate = cursor ? locateCursorCandidate(context, cursor) : null;

  if (cursor && !cursorCandidate) {
    throw new Error(
      `Duplicate candidate cursor ${JSON.stringify(cursor)} was not found in the current scan. `
      + 'Restart from the first page because the source or candidate-selection scope may have changed.',
    );
  }

  let candidatesAfterCursor = 0;

  scanCandidateMatches(context, (candidate) => {
    totalCandidates += 1;

    if (!cursor) {
      retainCandidate(selected, candidate, maxCandidates);
      candidatesAfterCursor += 1;
    } else if (compareCandidates(candidate, cursorCandidate) > 0) {
      candidatesAfterCursor += 1;
      retainCandidate(selected, candidate, maxCandidates);
    }
  });

  selected.sort(compareCandidates);
  const truncated = candidatesAfterCursor > selected.length;

  return {
    candidates: selected,
    pagination: {
      cursor: cursor ?? null,
      totalCandidates,
      returnedCandidates: selected.length,
      truncated,
      nextCursor: truncated ? selected.at(-1)?.id ?? null : null,
    },
  };
}

export function estimateCandidateComparisons(units, options = {}) {
  return estimateContextComparisons(createCandidateContext(units, options));
}

export function paginateCandidates(candidates, { maxCandidates, cursor } = {}) {
  const limit = maxCandidates ?? candidates.length;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error('maxCandidates must be a positive integer.');
  }

  let start = 0;

  if (cursor) {
    const cursorIndex = candidates.findIndex((candidate) => candidate.id === cursor);

    if (cursorIndex === -1) {
      throw new Error(`Duplicate candidate cursor ${JSON.stringify(cursor)} was not found.`);
    }

    start = cursorIndex + 1;
  }

  const page = candidates.slice(start, start + limit);
  const truncated = start + page.length < candidates.length;

  return {
    candidates: page,
    pagination: {
      cursor: cursor ?? null,
      totalCandidates: candidates.length,
      returnedCandidates: page.length,
      truncated,
      nextCursor: truncated ? page.at(-1)?.id ?? null : null,
    },
  };
}

export function normalizeIgnorePairs(ignorePairs = []) {
  if (!Array.isArray(ignorePairs)) {
    throw new Error('Duplicate candidate ignore pairs must be an array.');
  }

  return ignorePairs.map((entry) => {
    validateIgnorePairDefinition(entry);

    try {
      return {
        left: new RegExp(entry.left),
        right: new RegExp(entry.right),
        ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      };
    } catch (error) {
      throw new Error(`Invalid duplicate candidate ignore pair regex: ${error.message}`);
    }
  });
}

export function isIgnoredPair(leftFile, rightFile, ignorePairs = [], cache = null) {
  const left = normalizeRepoRelativePath(leftFile, 'Duplicate candidate file');
  const right = normalizeRepoRelativePath(rightFile, 'Duplicate candidate file');
  const cacheKey = left < right ? `${left}\0${right}` : `${right}\0${left}`;

  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const ignored = ignorePairs.some((entry) => (
    (matches(entry.left, left) && matches(entry.right, right))
    || (matches(entry.left, right) && matches(entry.right, left))
  ));
  cache?.set(cacheKey, ignored);
  return ignored;
}

export function scorePair(left, right) {
  return scorePreparedPair(left, right, new WeakMap());
}

function createCandidateContext(units, {
  focusFiles = null,
  includeSameFile = false,
  ignorePairs = [],
  minSimilarity = 0.72,
} = {}) {
  const sortedUnits = annotateOccurrences(units);
  const normalizedFocusFiles = focusFiles === null
    ? null
    : [...new Set(focusFiles.map((file) => (
        normalizeRepoRelativePath(file, 'Duplicate candidate focus file')
      )))];
  const groupsByFile = new Map();

  for (const unit of sortedUnits) {
    const group = groupsByFile.get(unit.file) ?? { file: unit.file, units: [] };
    group.units.push(unit);
    groupsByFile.set(unit.file, group);
  }

  return {
    fileGroups: [...groupsByFile.values()],
    focus: new Set(normalizedFocusFiles ?? []),
    hasExplicitFocus: normalizedFocusFiles !== null,
    includeSameFile,
    pairIgnores: normalizeIgnorePairs(ignorePairs),
    ignoreCache: new Map(),
    featureCache: new WeakMap(),
    cursorPair: null,
    minSimilarity,
  };
}

function estimateContextComparisons(context, stopAfter = Number.POSITIVE_INFINITY) {
  let comparisons = 0;

  for (const [leftGroup, rightGroup] of eligibleFileGroupPairs(context)) {
    const increment = leftGroup === rightGroup
      ? (leftGroup.units.length * (leftGroup.units.length - 1)) / 2
      : leftGroup.units.length * rightGroup.units.length;

    if (!Number.isSafeInteger(increment) || comparisons > Number.MAX_SAFE_INTEGER - increment) {
      return Number.POSITIVE_INFINITY;
    }

    comparisons += increment;

    if (comparisons > stopAfter) {
      return comparisons;
    }
  }

  return comparisons;
}

function scanCandidateMatches(context, visitCandidate) {
  for (const [left, right] of eligibleUnitPairs(context)) {
    const match = context.cursorPair?.left === left && context.cursorPair?.right === right
      ? context.cursorPair.match
      : scorePreparedPair(left, right, context.featureCache);

    if (match.similarity >= context.minSimilarity || match.signal === 'normalized exact match') {
      visitCandidate(toCandidate(left, right, match));
    }
  }
}

function locateCursorCandidate(context, cursor) {
  for (const [left, right] of eligibleUnitPairs(context)) {
    if (candidateId(left, right) !== cursor) {
      continue;
    }

    const match = scorePreparedPair(left, right, context.featureCache);
    context.cursorPair = { left, right, match };
    return match.similarity >= context.minSimilarity || match.signal === 'normalized exact match'
      ? toCandidate(left, right, match)
      : null;
  }

  return null;
}

function* eligibleUnitPairs(context) {
  for (const [leftGroup, rightGroup] of eligibleFileGroupPairs(context)) {
    if (leftGroup === rightGroup) {
      for (let leftIndex = 0; leftIndex < leftGroup.units.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < rightGroup.units.length;
          rightIndex += 1
        ) {
          yield [leftGroup.units[leftIndex], rightGroup.units[rightIndex]];
        }
      }
    } else {
      for (const left of leftGroup.units) {
        for (const right of rightGroup.units) {
          yield [left, right];
        }
      }
    }
  }
}

function* eligibleFileGroupPairs(context) {
  const { fileGroups } = context;

  if (!context.hasExplicitFocus) {
    for (let leftIndex = 0; leftIndex < fileGroups.length; leftIndex += 1) {
      const firstRightIndex = context.includeSameFile ? leftIndex : leftIndex + 1;

      for (let rightIndex = firstRightIndex; rightIndex < fileGroups.length; rightIndex += 1) {
        const left = fileGroups[leftIndex];
        const right = fileGroups[rightIndex];

        if (!isIgnoredPair(left.file, right.file, context.pairIgnores, context.ignoreCache)) {
          yield [left, right];
        }
      }
    }

    return;
  }

  const indexes = new Map(fileGroups.map((group, index) => [group.file, index]));
  const focusedGroups = fileGroups.filter((group) => context.focus.has(group.file));

  for (const focused of focusedGroups) {
    const focusedIndex = indexes.get(focused.file);

    for (let otherIndex = 0; otherIndex < fileGroups.length; otherIndex += 1) {
      const other = fileGroups[otherIndex];

      if (otherIndex === focusedIndex && !context.includeSameFile) {
        continue;
      }

      if (context.focus.has(other.file) && otherIndex < focusedIndex) {
        continue;
      }

      const [left, right] = otherIndex < focusedIndex
        ? [other, focused]
        : [focused, other];

      if (!isIgnoredPair(left.file, right.file, context.pairIgnores, context.ignoreCache)) {
        yield [left, right];
      }
    }
  }
}

function annotateOccurrences(units) {
  const counts = new Map();

  return [...units]
    .map((unit) => ({
      ...unit,
      file: normalizeRepoRelativePath(unit.file, 'Duplicate candidate unit file'),
    }))
    .sort(compareUnits)
    .map((unit) => {
      const contentKey = `${unit.file}\0${unit.normalized}\0${unit.text}`;
      const occurrence = (counts.get(contentKey) ?? 0) + 1;
      counts.set(contentKey, occurrence);
      return { ...unit, contentKey, occurrence };
    });
}

function validateIgnorePairDefinition(entry) {
  if (
    !entry
    || typeof entry !== 'object'
    || Array.isArray(entry)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(entry))
  ) {
    throw new Error('Duplicate candidate ignore pair entries must be plain objects.');
  }

  const allowedKeys = new Set(['left', 'right', 'reason']);
  const keys = Reflect.ownKeys(entry);
  const unknownKey = keys.find((key) => typeof key !== 'string' || !allowedKeys.has(key));

  if (unknownKey !== undefined) {
    throw new Error(
      `Duplicate candidate ignore pair has unsupported key ${String(unknownKey)}; `
      + 'only left, right, and reason are allowed.',
    );
  }

  if (
    typeof entry.left !== 'string'
    || entry.left.trim().length === 0
    || typeof entry.right !== 'string'
    || entry.right.trim().length === 0
  ) {
    throw new Error(
      'Duplicate candidate ignore pairs must include non-empty left and right regex strings.',
    );
  }

  if (entry.reason !== undefined && typeof entry.reason !== 'string') {
    throw new Error('Duplicate candidate ignore pair reason must be a string when provided.');
  }
}

function scorePreparedPair(left, right, featureCache) {
  if (left.normalized === right.normalized) {
    return { similarity: 1, signal: 'normalized exact match' };
  }

  const leftFeatures = similarityFeatures(left, featureCache);
  const rightFeatures = similarityFeatures(right, featureCache);
  const shingle = jaccard(leftFeatures.shingles, rightFeatures.shingles);
  const wordOverlap = overlapSets(leftFeatures.words, rightFeatures.words);
  const charDice = diceCoefficient(leftFeatures.bigrams, rightFeatures.bigrams);
  const similarity = Math.max(shingle, wordOverlap * 0.96, charDice * 0.9);

  if (shingle >= wordOverlap && shingle >= charDice) {
    return { similarity, signal: 'high shingle overlap' };
  }

  if (wordOverlap >= charDice) {
    return { similarity, signal: 'high word overlap' };
  }

  return { similarity, signal: 'high string similarity' };
}

function similarityFeatures(unit, cache) {
  let features = cache.get(unit);

  if (!features) {
    features = {
      shingles: shingles(unit.words, 4),
      words: new Set(unit.words),
      bigrams: bigrams(unit.normalized),
    };
    cache.set(unit, features);
  }

  return features;
}

function retainCandidate(candidates, candidate, limit) {
  let low = 0;
  let high = candidates.length;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (compareCandidates(candidates[middle], candidate) <= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  if (low < limit) {
    candidates.splice(low, 0, candidate);

    if (candidates.length > limit) {
      candidates.pop();
    }
  }
}

function candidateId(left, right) {
  const identity = [
    `${left.contentKey}\0${left.occurrence}`,
    `${right.contentKey}\0${right.occurrence}`,
  ].join('\0');
  const digest = createHash('sha256').update(identity).digest('hex').slice(0, 16);
  return `DUP-${digest}`;
}

function toCandidate(left, right, match) {
  return {
    id: candidateId(left, right),
    similarity: match.similarity,
    signal: match.signal,
    left: pickUnit(left),
    right: pickUnit(right),
  };
}

function pickUnit(unit) {
  return {
    file: unit.file,
    line: unit.line,
    text: unit.text,
  };
}

function compareCandidates(left, right) {
  if (left.similarity !== right.similarity) {
    return right.similarity - left.similarity;
  }

  return compareText(left.left.file, right.left.file)
    || left.left.line - right.left.line
    || compareText(left.right.file, right.right.file)
    || left.right.line - right.right.line
    || compareText(left.id, right.id);
}

function compareUnits(left, right) {
  return compareText(left.file, right.file)
    || left.line - right.line
    || compareText(left.normalized, right.normalized)
    || compareText(left.text, right.text)
    || compareText(left.id ?? '', right.id ?? '');
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
}

function matches(expression, value) {
  expression.lastIndex = 0;
  return expression.test(value);
}

function shingles(words, size) {
  if (words.length < size) {
    return new Set(words);
  }

  const result = new Set();

  for (let index = 0; index <= words.length - size; index += 1) {
    result.add(words.slice(index, index + size).join(' '));
  }

  return result;
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }

  return intersection / (left.size + right.size - intersection);
}

function overlapSets(left, right) {
  const smaller = left.size < right.size ? left : right;
  const larger = left.size < right.size ? right : left;

  if (smaller.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const word of smaller) {
    if (larger.has(word)) {
      intersection += 1;
    }
  }

  return intersection / smaller.size;
}

function diceCoefficient(left, right) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const pair of left) {
    if (right.has(pair)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.size + right.size);
}

function bigrams(text) {
  const normalized = text.replace(/\s+/g, ' ');
  const result = new Set();

  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }

  return result;
}
