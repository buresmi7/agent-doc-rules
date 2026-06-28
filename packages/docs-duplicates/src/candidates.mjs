export function findCandidatePairs(units, {
  includeSameFile = false,
  ignorePairs = [],
  warnScore = 0.78,
  maxCandidates = 50,
} = {}) {
  const threshold = Math.min(warnScore, 0.72);
  const pairIgnores = normalizeIgnorePairs(ignorePairs);
  const candidates = [];

  for (let leftIndex = 0; leftIndex < units.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < units.length; rightIndex += 1) {
      const left = units[leftIndex];
      const right = units[rightIndex];

      if (!includeSameFile && left.file === right.file) {
        continue;
      }

      if (isIgnoredPair(left.file, right.file, pairIgnores)) {
        continue;
      }

      const score = scorePair(left, right);

      if (score.score >= threshold || score.reason === 'normalized exact match') {
        candidates.push({
          id: `DUP-${candidates.length + 1}`,
          score: score.score,
          reason: score.reason,
          left: pickUnit(left),
          right: pickUnit(right),
        });
      }
    }
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, maxCandidates)
    .map((candidate, index) => ({
      ...candidate,
      id: `DUP-${index + 1}`,
    }));
}

export function normalizeIgnorePairs(ignorePairs = []) {
  return ignorePairs.map((entry) => {
    if (!entry?.left || !entry?.right) {
      throw new Error('Duplicate ignore pairs must include left and right regex strings.');
    }

    return {
      left: new RegExp(entry.left),
      right: new RegExp(entry.right),
    };
  });
}

export function isIgnoredPair(leftFile, rightFile, ignorePairs = []) {
  return ignorePairs.some((entry) => (
    (entry.left.test(leftFile) && entry.right.test(rightFile))
    || (entry.left.test(rightFile) && entry.right.test(leftFile))
  ));
}

export function scorePair(left, right) {
  if (left.normalized === right.normalized) {
    return { score: 1, reason: 'normalized exact match' };
  }

  const shingle = jaccard(shingles(left.words, 4), shingles(right.words, 4));
  const wordOverlap = overlap(left.words, right.words);
  const charDice = diceCoefficient(left.normalized, right.normalized);
  const score = Math.max(shingle, wordOverlap * 0.96, charDice * 0.9);

  if (shingle >= wordOverlap && shingle >= charDice) {
    return { score, reason: 'high shingle overlap' };
  }

  if (wordOverlap >= charDice) {
    return { score, reason: 'high word overlap' };
  }

  return { score, reason: 'high string similarity' };
}

function pickUnit(unit) {
  return {
    file: unit.file,
    line: unit.line,
    text: unit.text,
  };
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

function overlap(leftWords, rightWords) {
  const left = new Set(leftWords);
  const right = new Set(rightWords);
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
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);

  if (leftPairs.size === 0 || rightPairs.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const pair of leftPairs) {
    if (rightPairs.has(pair)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (leftPairs.size + rightPairs.size);
}

function bigrams(text) {
  const normalized = text.replace(/\s+/g, ' ');
  const result = new Set();

  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }

  return result;
}
