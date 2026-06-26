import { runCodexStyleReviewer } from './codex.mjs';
import { loadMarkdownUnits } from './markdown.mjs';

export async function checkStyle(options, deps = {}) {
  const loadUnits = deps.loadMarkdownUnits ?? loadMarkdownUnits;
  const reviewStyle = deps.reviewStyle ?? runCodexStyleReviewer;
  const { files, units } = await loadUnits(options);
  const reviewUnits = units.slice(0, options.maxUnits);

  if (reviewUnits.length === 0) {
    return {
      code: 0,
      files,
      units,
      reviewUnits,
      findings: [],
      report: formatStyleReport({ files, units, reviewUnits, findings: [] }),
    };
  }

  const rawResult = await reviewStyle(reviewUnits, options);
  const findings = normalizeStyleFindings({ reviewUnits, rawResult });
  const failCount = findings.filter((finding) => finding.status === 'fail').length;

  return {
    code: failCount > 0 ? 1 : 0,
    files,
    units,
    reviewUnits,
    findings,
    report: formatStyleReport({ files, units, reviewUnits, findings }),
  };
}

export function normalizeStyleFindings({ reviewUnits, rawResult }) {
  const unitsById = new Map(reviewUnits.map((unit) => [unit.id, unit]));

  return (rawResult.findings ?? [])
    .filter((finding) => ['fail', 'warn'].includes(finding.status))
    .map((finding) => {
      const unit = unitsById.get(finding.id);

      return {
        id: finding.id,
        status: finding.status,
        category: finding.category,
        issue: finding.issue,
        suggestion: finding.suggestion,
        confidence: Number(finding.confidence),
        file: unit?.file ?? 'unknown',
        line: unit?.line ?? 1,
        text: unit?.text ?? '',
      };
    });
}

export function formatStyleReport({ files, units, reviewUnits, findings }) {
  const lines = [
    'Docs AI style review',
    `Files: ${files.length}`,
    `Text units: ${units.length}`,
    `Reviewed units: ${reviewUnits.length}`,
  ];

  if (findings.length === 0) {
    lines.push('No AI style findings.');
    return `${lines.join('\n')}\n`;
  }

  const grouped = {
    fail: findings.filter((finding) => finding.status === 'fail'),
    warn: findings.filter((finding) => finding.status === 'warn'),
  };

  for (const status of ['fail', 'warn']) {
    for (const finding of grouped[status]) {
      lines.push('');
      lines.push(`[${status}] ${finding.id} confidence=${formatConfidence(finding.confidence)} category=${finding.category}`);
      lines.push(`${finding.file}:${finding.line}`);
      lines.push(`Issue: ${finding.issue}`);
      lines.push(`Suggestion: ${finding.suggestion}`);
    }
  }

  lines.push('');
  lines.push(`Summary: ${grouped.fail.length} fail, ${grouped.warn.length} warn`);

  return `${lines.join('\n')}\n`;
}

function formatConfidence(confidence) {
  return Number.isFinite(confidence) ? confidence.toFixed(2) : 'n/a';
}
