import { findCandidatePairs } from './candidates.mjs';
import { runCodexClassifier } from './codex.mjs';
import { loadMarkdownUnits } from './markdown.mjs';

export async function checkDuplicates(options, deps = {}) {
  const loadUnits = deps.loadMarkdownUnits ?? loadMarkdownUnits;
  const classifyCandidates = deps.classifyCandidates ?? runCodexClassifier;
  const { files, units } = await loadUnits(options);
  const candidates = findCandidatePairs(units, options);

  if (candidates.length === 0) {
    return {
      code: 0,
      files,
      units,
      candidates,
      reviews: [],
      report: formatReport({ files, units, candidates, reviews: [] }),
    };
  }

  const rawResult = await classifyCandidates(candidates, options);
  const reviews = normalizeReviews({ candidates, rawResult, options });
  const failCount = reviews.filter((review) => review.status === 'fail').length;

  return {
    code: failCount > 0 ? 1 : 0,
    files,
    units,
    candidates,
    reviews,
    report: formatReport({ files, units, candidates, reviews }),
  };
}

export function normalizeReviews({ candidates, rawResult, options }) {
  const byId = new Map((rawResult.matches ?? []).map((match) => [match.id, match]));

  return candidates.map((candidate) => {
    const match = byId.get(candidate.id);

    if (!match) {
      return {
        ...candidate,
        status: 'warn',
        duplicateScore: candidate.score,
        reviewReason: 'Codex did not classify this candidate.',
      };
    }

    const duplicateScore = Number(match.score);
    const status = normalizeStatus(match.status)
      ?? (Number.isFinite(duplicateScore) ? statusFromScore(duplicateScore, options) : 'warn');

    return {
      ...candidate,
      status,
      duplicateScore: Number.isFinite(duplicateScore) ? duplicateScore : candidate.score,
      reviewReason: match.reason,
    };
  });
}

export function formatReport({ files, units, candidates, reviews }) {
  const lines = [
    'Docs semantic duplicate check',
    `Files: ${files.length}`,
    `Text units: ${units.length}`,
    `Candidates: ${candidates.length}`,
  ];

  if (candidates.length === 0) {
    lines.push('No semantic duplicate candidates found.');
    return `${lines.join('\n')}\n`;
  }

  const grouped = {
    fail: reviews.filter((review) => review.status === 'fail'),
    warn: reviews.filter((review) => review.status === 'warn'),
    ok: reviews.filter((review) => review.status === 'ok'),
  };

  for (const status of ['fail', 'warn']) {
    for (const review of grouped[status]) {
      lines.push('');
      lines.push(`[${status}] ${review.id} score=${review.duplicateScore.toFixed(2)}`);
      lines.push(`${review.left.file}:${review.left.line}`);
      lines.push(`${review.right.file}:${review.right.line}`);
      lines.push(review.reviewReason);
    }
  }

  lines.push('');
  lines.push(`Summary: ${grouped.fail.length} fail, ${grouped.warn.length} warn, ${grouped.ok.length} ok`);

  return `${lines.join('\n')}\n`;
}

function statusFromScore(score, { warnScore, failScore }) {
  if (score >= failScore) {
    return 'fail';
  }

  if (score >= warnScore) {
    return 'warn';
  }

  return 'ok';
}

function normalizeStatus(status) {
  return ['fail', 'warn', 'ok'].includes(status) ? status : null;
}
