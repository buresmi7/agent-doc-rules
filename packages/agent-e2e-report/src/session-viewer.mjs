import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  createE2eSessionDocument,
  sessionFileSource,
  sessionItemSource,
  validateAgentSessionDocument,
} from './session-document.mjs';

export {
  agentSessionFormat,
  agentSessionSchemaVersion,
  applyScenarioExpectations,
  createAgentSessionDocument,
  createE2eSessionDocument,
  importCodexExecJsonl,
  importCodexThread,
  sessionFileSource,
  sessionItemSource,
  validateAgentSessionDocument,
  withSessionAnnotations,
} from './session-document.mjs';

export const failureReportFileName = 'failure-report.html';
export const failureSummaryFileName = 'failure-summary.json';
export const agentSessionFileName = 'agent-session.json';

export async function writeFailureArtifacts({
  outputDir,
  projectDir,
  scenarioDir,
  repoRoot,
  scenarioName,
  runner,
  agentMetadata,
  inspectLinks = {},
  scenarioSource,
  stage,
  changes = [],
  reportChanges = [],
  conversationTurns = [],
  judgment = null,
  transcript = '',
  error = null,
  annotations = [],
}) {
  const summary = buildFailureSummary({
    outputDir,
    projectDir,
    scenarioDir,
    repoRoot,
    scenarioName,
    runner,
    agentMetadata,
    inspectLinks,
    scenarioSource,
    stage,
    changes,
    conversationTurns,
    judgment,
    transcript,
    error,
  });
  const failureSummaryPath = join(outputDir, failureSummaryFileName);
  const failureReportPath = join(outputDir, failureReportFileName);
  const agentSessionPath = join(outputDir, agentSessionFileName);
  const writeErrors = [];

  const summaryWritten = await writeArtifact(
    failureSummaryPath,
    `${JSON.stringify(summary, null, 2)}\n`,
    'failure summary',
    writeErrors,
  );

  let reportHtml;
  let sessionDocument;

  try {
    sessionDocument = createE2eSessionDocument({
      summary,
      conversationTurns,
      reportChanges,
      annotations,
    });
    reportHtml = renderSessionViewer(sessionDocument);
  } catch (reportError) {
    writeErrors.push(`Could not render failure report: ${reportError.message}`);
  }

  const sessionWritten = sessionDocument
    ? await writeArtifact(
        agentSessionPath,
        `${JSON.stringify(sessionDocument, null, 2)}\n`,
        'agent session',
        writeErrors,
      )
    : false;
  const reportWritten = reportHtml
    ? await writeArtifact(
        failureReportPath,
        reportHtml,
        'failure report',
        writeErrors,
      )
    : false;

  return {
    agentSessionPath: sessionWritten ? agentSessionPath : undefined,
    failureSummaryPath: summaryWritten ? failureSummaryPath : undefined,
    failureReportPath: reportWritten ? failureReportPath : undefined,
    writeErrors,
  };
}

export function buildFailureSummary({
  outputDir,
  projectDir,
  scenarioDir,
  repoRoot,
  scenarioName,
  runner,
  agentMetadata,
  inspectLinks = {},
  scenarioSource,
  stage,
  changes = [],
  conversationTurns = [],
  judgment = null,
  transcript = '',
  error = null,
}) {
  return {
    scenario: scenarioName,
    runner,
    agent: agentMetadata,
    status: judgment ? 'judged-failure' : 'runtime-error',
    stage,
    pass: false,
    score: judgment?.score ?? null,
    failedCriteria: judgment?.failedCriteria ?? [],
    requiredFixes: judgment?.requiredFixes ?? [],
    transcript,
    judgeNotes: judgment?.notes ?? '',
    error: error
      ? {
          name: error.name ?? 'Error',
          message: summarizeErrorMessage(error),
        }
      : null,
    turns: conversationTurns.map((turn) => ({
      id: turn.id,
      source: turn.source,
      prompt: turn.prompt,
      incomplete: Boolean(turn.incomplete),
      criteria: (turn.criteria ?? []).map((criterion) => ({
        id: criterion.id,
        source: criterion.source,
        content: criterion.content,
      })),
      changes: (turn.changes ?? []).map((file) => ({
        path: file.path,
        status: file.status,
      })),
      activity: turn.activity ?? [],
      response: turn.response ?? '',
    })),
    changes: changes.map((file) => ({
      path: file.path,
      status: file.status,
      projectPath: join('project', file.path).replaceAll('\\', '/'),
      lineCount: typeof file.content === 'string' && file.encoding !== 'base64'
        ? file.content.trimEnd().split('\n').length
        : null,
    })),
    inspect: {
      outputDir,
      projectDir: relative(outputDir, projectDir),
      scenario: repoRoot
        ? relative(repoRoot, join(scenarioDir, scenarioSource))
        : join(scenarioDir, scenarioSource),
      ...inspectLinks,
    },
  };
}

export function renderFailureReport({
  summary,
  conversationTurns = [],
  reportChanges = [],
}) {
  return renderSessionViewer(createE2eSessionDocument({
    summary,
    conversationTurns,
    reportChanges,
  }));
}

export function renderSessionViewer(sessionDocument) {
  validateAgentSessionDocument(sessionDocument);

  const summary = buildViewerSummary(sessionDocument);
  const conversationTurns = sessionDocument.turns;
  const reportChanges = sessionDocument.project?.finalChanges ?? [];
  const annotations = sessionDocument.annotations ?? [];
  const filesHrefBase = safeRelativeHrefBase(
    sessionDocument.project?.filesHrefBase,
  );
  const title = `${summary.scenario} session`;
  const score = summary.score === null ? 'n/a' : summary.score;
  const statusLabel = formatStatusLabel(summary.status);
  const statusClass = summary.status === 'runtime-error'
    ? 'error'
    : summary.status === 'judged-failure'
      ? 'failure'
      : 'recorded';
  const agentLabel = summary.agent?.model?.agent?.label
    ?? summary.agent?.name
    ?? null;
  const metrics = [
    ['Status', statusLabel],
    summary.score === null ? null : ['Score', score],
    ['Source', summary.runner ?? 'unknown'],
    agentLabel ? ['Agent', agentLabel] : null,
    summary.stage ? ['Stage', summary.stage] : null,
    summary.sessionId ? ['Session', summary.sessionId] : null,
    ['Changed files', summary.changes?.length ?? 0],
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --background: #f5f7fa;
      --surface: #ffffff;
      --surface-muted: #f0f3f7;
      --border: #d8dee8;
      --text: #18202b;
      --muted: #5d6878;
      --failure: #b42318;
      --failure-surface: #fff1f0;
      --created: #137333;
      --created-surface: #edf8ef;
      --deleted: #b42318;
      --deleted-surface: #fff1f0;
      --modified: #8a4b08;
      --modified-surface: #fff6e5;
      --code: #101828;
      --code-surface: #f8fafc;
      font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", sans-serif;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --background: #11151b;
        --surface: #1b212b;
        --surface-muted: #232b37;
        --border: #374151;
        --text: #edf1f7;
        --muted: #aeb8c7;
        --failure: #ff8a80;
        --failure-surface: #3b2020;
        --created: #78d990;
        --created-surface: #183522;
        --deleted: #ff8a80;
        --deleted-surface: #3b2020;
        --modified: #ffc46b;
        --modified-surface: #3a2d16;
        --code: #edf1f7;
        --code-surface: #121821;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--background);
      color: var(--text);
      line-height: 1.5;
    }

    main {
      width: min(1680px, calc(100% - 32px));
      margin: 24px auto 64px;
    }

    h1,
    h2,
    h3,
    p {
      margin-top: 0;
    }

    h1 {
      margin-bottom: 8px;
      font-size: clamp(1.65rem, 4vw, 2.4rem);
      line-height: 1.15;
    }

    h2 {
      margin-bottom: 0;
      font-size: 1.2rem;
    }

    h3 {
      margin-bottom: 10px;
      font-size: 0.95rem;
    }

    a {
      color: inherit;
    }

    .card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      box-shadow: 0 1px 2px rgb(16 24 40 / 5%);
    }

    .report-header {
      padding: 24px;
      border-top: 5px solid var(--muted);
    }

    .report-header.failure,
    .report-header.error {
      border-top-color: var(--failure);
    }

    .eyebrow {
      margin-bottom: 6px;
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 750;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .report-header.failure .eyebrow,
    .report-header.error .eyebrow {
      color: var(--failure);
    }

    .subtitle,
    .muted {
      color: var(--muted);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-top: 20px;
    }

    .metric {
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: var(--surface-muted);
    }

    .metric-label {
      display: block;
      margin-bottom: 3px;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .metric-value {
      overflow-wrap: anywhere;
      font-weight: 650;
    }

    .failure-details {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }

    .failure-details > section {
      padding: 18px;
    }

    .failure-details ul {
      margin: 0;
      padding-left: 20px;
    }

    .failure-details li + li {
      margin-top: 8px;
    }

    .error {
      margin-top: 16px;
      padding: 16px;
      border: 1px solid var(--failure);
      border-radius: 10px;
      background: var(--failure-surface);
    }

    .turn {
      margin-top: 18px;
      overflow: hidden;
    }

    .turn-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-muted);
    }

    .turn-source {
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.75rem;
      overflow-wrap: anywhere;
    }

    .turn-grid {
      display: grid;
      grid-template-columns: minmax(320px, 0.8fr) minmax(460px, 1.2fr);
    }

    .conversation,
    .project-changes {
      min-width: 0;
      padding: 18px;
    }

    .conversation {
      border-right: 1px solid var(--border);
    }

    .message {
      margin-bottom: 16px;
      padding: 13px 14px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: var(--surface-muted);
    }

    .message.agent {
      background: var(--surface);
    }

    .message.annotated {
      border-color: var(--modified);
      box-shadow: 0 0 0 2px var(--modified-surface);
    }

    .message-label {
      display: block;
      margin-bottom: 7px;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 750;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    pre {
      margin: 0;
      color: var(--code);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.79rem;
      line-height: 1.5;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    mark.annotation {
      padding: 0 2px;
      border-radius: 3px;
      color: inherit;
      background: #fff0a8;
    }

    mark.annotation.failure {
      background: #ffc9c5;
    }

    @media (prefers-color-scheme: dark) {
      mark.annotation {
        background: #665516;
      }

      mark.annotation.failure {
        background: #71312d;
      }
    }

    .annotation-notes {
      margin: 9px 0 0;
      padding-left: 20px;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .expectations {
      margin: -4px 0 16px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: var(--code-surface);
    }

    .expectations h3 {
      margin-bottom: 8px;
    }

    .expectation-list {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .expectation {
      padding: 9px 10px;
      border-left: 4px solid var(--muted);
      border-radius: 6px;
      background: var(--surface);
    }

    .expectation.passed {
      border-left-color: var(--created);
    }

    .expectation.failed {
      border-left-color: var(--failure);
      background: var(--failure-surface);
    }

    .expectation-status {
      display: inline-block;
      margin-right: 7px;
      color: var(--muted);
      font-size: 0.68rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .expectation.passed .expectation-status {
      color: var(--created);
    }

    .expectation.failed .expectation-status {
      color: var(--failure);
    }

    .expectation-id {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .expectation p {
      margin: 5px 0 0;
      font-size: 0.84rem;
    }

    .expectation-reason {
      color: var(--failure);
    }

    .activity {
      margin: 0;
      padding-left: 20px;
      color: var(--muted);
      font-size: 0.86rem;
    }

    .activity-details > summary {
      margin-bottom: 9px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .activity li + li {
      margin-top: 5px;
    }

    .file {
      border: 1px solid var(--border);
      border-radius: 9px;
      overflow: hidden;
    }

    .file + .file {
      margin-top: 10px;
    }

    .file summary {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 10px 12px;
      cursor: pointer;
      background: var(--surface-muted);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 0.82rem;
      font-weight: 650;
      overflow-wrap: anywhere;
    }

    .file-status {
      flex: 0 0 auto;
      padding: 2px 7px;
      border-radius: 999px;
      font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", sans-serif;
      font-size: 0.68rem;
      font-weight: 750;
      text-transform: uppercase;
    }

    .file-status.created {
      color: var(--created);
      background: var(--created-surface);
    }

    .file-status.modified {
      color: var(--modified);
      background: var(--modified-surface);
    }

    .file-status.deleted {
      color: var(--deleted);
      background: var(--deleted-surface);
    }

    .comparison {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-top: 1px solid var(--border);
    }

    .version {
      min-width: 0;
      background: var(--code-surface);
    }

    .version + .version {
      border-left: 1px solid var(--border);
    }

    .version-label {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--border);
      color: var(--muted);
      background: var(--surface);
      font-size: 0.7rem;
      font-weight: 750;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .version.before .version-label {
      background: var(--deleted-surface);
    }

    .version.after .version-label {
      background: var(--created-surface);
    }

    .version pre {
      max-height: 520px;
      padding: 11px;
    }

    .file-note,
    .empty {
      min-height: 70px;
      padding: 12px;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .patch {
      max-height: 520px;
      padding: 11px;
      border-top: 1px solid var(--border);
      background: var(--code-surface);
    }

    .final-changes,
    .inspection {
      margin-top: 18px;
      padding: 18px;
    }

    .inspection dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 7px 14px;
      margin: 0;
      font-size: 0.85rem;
    }

    .inspection dt {
      color: var(--muted);
      font-weight: 700;
    }

    .inspection dd {
      margin: 0;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      overflow-wrap: anywhere;
    }

    .badge {
      display: inline-block;
      margin-left: 7px;
      padding: 2px 7px;
      border-radius: 999px;
      color: var(--failure);
      background: var(--failure-surface);
      font-size: 0.66rem;
      font-weight: 750;
      text-transform: uppercase;
      vertical-align: middle;
    }

    @media (max-width: 940px) {
      main {
        width: min(100% - 20px, 760px);
        margin-top: 10px;
      }

      .failure-details,
      .turn-grid,
      .comparison {
        grid-template-columns: 1fr;
      }

      .conversation {
        border-right: 0;
        border-bottom: 1px solid var(--border);
      }

      .version + .version {
        border-top: 1px solid var(--border);
        border-left: 0;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="card report-header ${statusClass}">
      <div class="eyebrow">${escapeHtml(statusLabel)}</div>
      <h1>${escapeHtml(summary.scenario)}</h1>
      <p class="subtitle">Conversation, expectations, tool activity, and project changes in one portable session view.</p>
      <div class="metrics">
        ${metrics.map(([label, value]) => renderMetric(label, value)).join('')}
      </div>
      ${renderError(summary.error)}
    </header>
    ${renderFailureDetails(summary)}
    ${conversationTurns.map((turn, index) => (
      renderTurn(turn, index, annotations, filesHrefBase)
    )).join('\n')}
    <section class="card final-changes">
      <h2>Session project changes</h2>
      <p class="muted">The final project difference or the file changes recorded by the session source.</p>
      ${renderFileChanges(reportChanges, {
        annotations,
        filesHrefBase,
        scope: 'final',
      })}
    </section>
    ${renderInspection(summary.inspect)}
  </main>
</body>
</html>
`;
}

function buildViewerSummary(sessionDocument) {
  const evaluation = sessionDocument.evaluation;
  const failedCriteria = sessionDocument.turns.flatMap((turn) => (
    (turn.expectations ?? [])
      .filter((expectation) => expectation.status === 'failed')
      .map((expectation) => ({
        id: expectation.id,
        reason: expectation.reason,
      }))
  ));
  const status = evaluation?.status === 'error' || sessionDocument.session.status === 'error'
    ? 'runtime-error'
    : evaluation?.status === 'failed' || sessionDocument.session.status === 'failed'
      ? 'judged-failure'
      : evaluation?.status === 'passed' || sessionDocument.session.status === 'passed'
        ? 'judged-pass'
        : 'recorded';

  return {
    scenario: sessionDocument.session.title,
    sessionId: sessionDocument.session.id,
    runner: sessionDocument.session.source?.runner
      ?? sessionDocument.session.source?.kind
      ?? 'unknown',
    agent: sessionDocument.session.metadata?.agent ?? null,
    status,
    stage: sessionDocument.session.metadata?.stage ?? null,
    score: evaluation?.score ?? null,
    failedCriteria,
    requiredFixes: evaluation?.requiredFixes ?? [],
    judgeNotes: evaluation?.notes ?? '',
    error: evaluation?.error ?? null,
    changes: sessionDocument.project?.finalChanges ?? [],
    inspect: {
      ...(sessionDocument.session.metadata?.cwd
        ? { cwd: sessionDocument.session.metadata.cwd }
        : {}),
      ...(sessionDocument.session.metadata?.inspect ?? {}),
    },
  };
}

function formatStatusLabel(status) {
  if (status === 'runtime-error') {
    return 'Runtime error';
  }

  if (status === 'judged-failure') {
    return 'Evaluation failed';
  }

  if (status === 'judged-pass') {
    return 'Evaluation passed';
  }

  return 'Recorded session';
}

function legacyTurnItems(turn) {
  return [
    {
      id: `${turn.id}:user`,
      type: 'user_message',
      text: turn.prompt ?? '',
    },
    ...(turn.activity ?? []).map((item, index) => ({
      id: item.id ?? `${turn.id}:activity:${index + 1}`,
      ...item,
    })),
    {
      id: `${turn.id}:assistant`,
      type: 'assistant_message',
      text: turn.response ?? '',
      phase: 'final',
    },
  ];
}

function annotationsForSource(annotations, sources) {
  const acceptedSources = new Set(sources.filter(Boolean));

  return annotations.filter((annotation) => {
    const target = annotation.target;

    if (typeof target === 'string') {
      return acceptedSources.has(target);
    }

    return target && acceptedSources.has(target.source);
  });
}

function renderAnnotatedText(value, annotations) {
  const text = String(value ?? '');
  const ranges = annotations
    .map((annotation) => ({
      annotation,
      range: annotationRange(annotation, text),
    }))
    .filter(({ range }) => range)
    .sort((left, right) => (
      left.range.start - right.range.start
      || right.range.end - left.range.end
    ));
  let cursor = 0;
  let output = '';

  for (const { annotation, range } of ranges) {
    if (range.start < cursor) {
      continue;
    }

    output += escapeHtml(text.slice(cursor, range.start));
    output += `<mark class="annotation${isFailureAnnotation(annotation) ? ' failure' : ''}"`;

    const note = annotationBodyText(annotation);

    if (note) {
      output += ` title="${escapeHtml(note)}"`;
    }

    output += `>${escapeHtml(text.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }

  output += escapeHtml(text.slice(cursor));

  return output;
}

function annotationRange(annotation, text) {
  const selectorValue = annotation.target?.selector;
  const selectors = Array.isArray(selectorValue) ? selectorValue : [selectorValue];

  for (const selector of selectors) {
    if (!selector || typeof selector !== 'object') {
      continue;
    }

    if (
      selector.type === 'TextPositionSelector'
      && Number.isInteger(selector.start)
      && Number.isInteger(selector.end)
      && selector.start >= 0
      && selector.end > selector.start
      && selector.end <= text.length
    ) {
      return { start: selector.start, end: selector.end };
    }

    if (
      selector.type === 'TextQuoteSelector'
      && typeof selector.exact === 'string'
      && selector.exact.length > 0
    ) {
      const range = findTextQuote(text, selector);

      if (range) {
        return range;
      }
    }
  }

  return null;
}

function findTextQuote(text, selector) {
  let start = text.indexOf(selector.exact);

  while (start !== -1) {
    const end = start + selector.exact.length;
    const hasPrefix = !selector.prefix
      || text.slice(Math.max(0, start - selector.prefix.length), start) === selector.prefix;
    const hasSuffix = !selector.suffix
      || text.slice(end, end + selector.suffix.length) === selector.suffix;

    if (hasPrefix && hasSuffix) {
      return { start, end };
    }

    start = text.indexOf(selector.exact, start + 1);
  }

  return null;
}

function renderAnnotationNotes(annotations) {
  const notes = annotations
    .map((annotation) => annotationBodyText(annotation))
    .filter(Boolean);

  if (notes.length === 0) {
    return '';
  }

  return `<ul class="annotation-notes">${notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join('')}</ul>`;
}

function annotationBodyText(annotation) {
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];

  return bodies
    .map((body) => {
      if (typeof body === 'string') {
        return body;
      }

      return body?.value ?? body?.text ?? '';
    })
    .filter(Boolean)
    .join(' ');
}

function isFailureAnnotation(annotation) {
  const bodies = Array.isArray(annotation.body)
    ? annotation.body
    : [annotation.body];

  return annotation.motivation === 'assessing'
    || bodies.some((body) => body?.tone === 'failure');
}

function renderMetric(label, value) {
  return `<div class="metric">
          <span class="metric-label">${escapeHtml(label)}</span>
          <span class="metric-value">${escapeHtml(value)}</span>
        </div>`;
}

function renderError(error) {
  if (!error) {
    return '';
  }

  return `<section class="error">
        <h2>${escapeHtml(error.name)}</h2>
        <pre>${escapeHtml(error.message)}</pre>
      </section>`;
}

function renderFailureDetails(summary) {
  const criteria = summary.failedCriteria ?? [];
  const fixes = summary.requiredFixes ?? [];
  const notes = summary.judgeNotes?.trim();

  if (criteria.length === 0 && fixes.length === 0 && !notes) {
    return '';
  }

  return `<div class="failure-details">
      <section class="card">
        <h2>Failed criteria</h2>
        ${criteria.length > 0
          ? `<ul>${criteria.map((criterion) => (
              `<li><strong>${escapeHtml(criterion.id)}</strong>: ${escapeHtml(criterion.reason)}</li>`
            )).join('')}</ul>`
          : '<p class="muted">No failed criteria were returned.</p>'}
      </section>
      <section class="card">
        <h2>Judge guidance</h2>
        ${notes ? `<p>${escapeHtml(notes)}</p>` : ''}
        ${fixes.length > 0
          ? `<ul>${fixes.map((fix) => `<li>${escapeHtml(fix)}</li>`).join('')}</ul>`
          : '<p class="muted">No required fixes were returned.</p>'}
      </section>
    </div>`;
}

function renderTurn(turn, index, annotations, filesHrefBase) {
  const items = Array.isArray(turn.items)
    ? turn.items
    : legacyTurnItems(turn);
  const activityItems = items.filter((item) => (
    item.type !== 'user_message' && item.type !== 'assistant_message'
  ));
  const expectations = turn.expectations ?? turn.criteria ?? [];
  const matchedExpectationIds = new Set();
  const source = turn.source ?? '';

  return `<section class="card turn">
      <header class="turn-header">
        <h2>Turn ${index + 1}: ${escapeHtml(turn.id)}${turn.status === 'incomplete' || turn.incomplete ? '<span class="badge">incomplete</span>' : ''}</h2>
        <span class="turn-source">${escapeHtml(source)}</span>
      </header>
      <div class="turn-grid">
        <section class="conversation">
          <h3>Conversation and activity</h3>
          ${items.length > 0
            ? renderTurnTimeline(
                items,
                expectations,
                annotations,
                matchedExpectationIds,
              )
            : '<p class="muted">No conversation items were recorded.</p>'}
          ${renderExpectations(expectations.filter(
            (expectation) => !matchedExpectationIds.has(expectation.id),
          ))}
          ${activityItems.length === 0
            ? '<p class="muted">No completed tool activity was recorded.</p>'
            : ''}
        </section>
        <section class="project-changes">
          <h3>Changes after this turn</h3>
          ${renderFileChanges(turn.projectChanges ?? turn.reportChanges ?? [], {
            annotations,
            filesHrefBase,
            scope: turn.id,
          })}
        </section>
      </div>
    </section>`;
}

function renderTurnTimeline(items, expectations, annotations, matchedExpectationIds) {
  let activity = [];
  let output = '';

  function flushActivity() {
    if (activity.length > 0) {
      output += renderActivity(activity);
      activity = [];
    }
  }

  for (const item of items) {
    if (item.type === 'user_message' || item.type === 'assistant_message') {
      flushActivity();
      output += renderMessageItem(
        item,
        expectations,
        annotations,
        matchedExpectationIds,
      );
    } else {
      activity.push(item);
    }
  }

  flushActivity();

  return output;
}

function renderMessageItem(item, expectations, annotations, matchedExpectationIds) {
  const isAgent = item.type === 'assistant_message';
  const text = item.text?.trim()
    ? item.text
    : isAgent
      ? 'No agent response was recorded.'
      : 'No user message text was recorded.';
  const itemAnnotations = annotationsForSource(annotations, [
    item.id,
    sessionItemSource(item.id),
  ]);
  const itemExpectations = expectations.filter((expectation) => (
    expectation.targetItemId === item.id
    || (!expectation.targetItemId && isAgent)
  ));

  for (const expectation of itemExpectations) {
    matchedExpectationIds.add(expectation.id);
  }

  const label = isAgent && item.phase
    ? `Agent · ${item.phase}`
    : isAgent
      ? 'Agent'
      : 'User';

  return `<div class="message${isAgent ? ' agent' : ''}${itemAnnotations.length > 0 ? ' annotated' : ''}">
            <span class="message-label">${escapeHtml(label)}</span>
            <pre>${renderAnnotatedText(text, itemAnnotations)}</pre>
            ${renderAnnotationNotes(itemAnnotations)}
          </div>
          ${renderExpectations(itemExpectations)}`;
}

function renderExpectations(expectations) {
  if (expectations.length === 0) {
    return '';
  }

  return `<section class="expectations">
          <h3>Expected for this response</h3>
          <ul class="expectation-list">${expectations.map((expectation) => {
            const status = ['passed', 'failed'].includes(expectation.status)
              ? expectation.status
              : 'not-evaluated';
            const statusLabel = status === 'not-evaluated'
              ? 'Not evaluated'
              : status;

            return `<li class="expectation ${status}">
              <span class="expectation-status">${escapeHtml(statusLabel)}</span>
              <span class="expectation-id">${escapeHtml(expectation.id)}</span>
              <p>${escapeHtml(expectation.text ?? expectation.content ?? '')}</p>
              ${expectation.reason
                ? `<p class="expectation-reason">${escapeHtml(expectation.reason)}</p>`
                : ''}
            </li>`;
          }).join('')}</ul>
        </section>`;
}

function renderActivity(activity) {
  if (activity.length === 0) {
    return `<h3>Completed tool activity</h3>
          <p class="muted">No completed tool activity was recorded.</p>`;
  }

  return `<details class="activity-details"${activity.length <= 8 ? ' open' : ''}>
          <summary>Completed tool activity (${activity.length})</summary>
          <ul class="activity">${activity
            .map((item) => `<li>${escapeHtml(formatActivity(item))}</li>`)
            .join('')}</ul>
        </details>`;
}

function formatActivity(item) {
  if (item.type === 'command_execution') {
    const outcome = Number.isInteger(item.exitCode)
      ? `exit ${item.exitCode}`
      : item.status ?? 'unknown status';

    return `Command (${outcome}): ${item.commandSummary ?? item.command ?? 'shell command'}`;
  }

  if (item.type === 'file_change') {
    const files = (item.changes ?? [])
      .map((change) => `${change.kind ?? 'changed'} ${change.path}`)
      .join(', ');

    return `File change (${item.status ?? 'unknown status'}): ${files || 'none'}`;
  }

  if (item.type === 'mcp_tool_call') {
    const name = [item.server, item.tool].filter(Boolean).join('/') || 'unknown tool';

    return `MCP tool (${item.status ?? 'unknown status'}): ${name}`;
  }

  if (item.type === 'web_search') {
    const query = item.query ? `: ${item.query}` : '';

    return `Web search (${item.status ?? 'unknown status'})${query}`;
  }

  if (item.type === 'reasoning') {
    return `Reasoning: ${item.summary ?? item.text ?? 'recorded'}`;
  }

  if (item.type === 'error') {
    return `Error: ${item.text ?? 'unknown error'}`;
  }

  return `${item.type ?? 'Unknown activity'} (${item.status ?? 'unknown status'})`;
}

function renderFileChanges(changes, {
  annotations = [],
  filesHrefBase = null,
  scope = 'final',
} = {}) {
  if (changes.length === 0) {
    return '<p class="muted">No project files changed.</p>';
  }

  return changes.map((change, index) => renderFileChange(change, index, {
    annotations,
    filesHrefBase,
    scope,
  })).join('');
}

function renderFileChange(change, index, {
  annotations,
  filesHrefBase,
  scope,
}) {
  const status = ['created', 'modified', 'deleted'].includes(change.status)
    ? change.status
    : 'modified';
  const path = escapeHtml(change.path);
  const pathLabel = change.after && filesHrefBase
    ? `<a href="${escapeHtml(projectFileHref(change.path, filesHrefBase))}">${path}</a>`
    : path;
  const patchAnnotations = annotationsForSource(annotations, [
    sessionFileSource({ scope, path: change.path, side: 'patch' }),
  ]);

  return `<details class="file"${index === 0 ? ' open' : ''}>
        <summary>
          <span class="file-status ${status}">${escapeHtml(status)}</span>
          <span>${pathLabel}</span>
        </summary>
        ${change.before || change.after
          ? `<div class="comparison">
          ${renderFileVersion('Before', change.before, {
            annotations,
            source: sessionFileSource({ scope, path: change.path, side: 'before' }),
          })}
          ${renderFileVersion('After', change.after, {
            annotations,
            source: sessionFileSource({ scope, path: change.path, side: 'after' }),
          })}
        </div>`
          : change.patch
            ? `<pre class="patch">${renderAnnotatedText(change.patch, patchAnnotations)}</pre>
        ${renderAnnotationNotes(patchAnnotations)}`
            : '<div class="file-note">No file content or patch was recorded.</div>'}
      </details>`;
}

function renderFileVersion(label, version, {
  annotations,
  source,
}) {
  const versionClass = label.toLowerCase();
  const versionAnnotations = annotationsForSource(annotations, [source]);

  if (!version) {
    return `<section class="version ${versionClass}">
          <div class="version-label"><span>${label}</span></div>
          <div class="empty">File did not exist.</div>
        </section>`;
  }

  const metadata = version.byteLength === undefined
    ? ''
    : `${formatBytes(version.byteLength)}`;

  if (version.kind === 'text') {
    return `<section class="version ${versionClass}">
          <div class="version-label"><span>${label}</span><span>${escapeHtml(metadata)}</span></div>
          <pre>${renderAnnotatedText(version.content, versionAnnotations)}</pre>
          ${renderAnnotationNotes(versionAnnotations)}
        </section>`;
  }

  const note = version.kind === 'binary'
    ? `Binary file, ${metadata}.`
    : `Content omitted because the file is ${metadata}.`;

  return `<section class="version ${versionClass}">
        <div class="version-label"><span>${label}</span><span>${escapeHtml(metadata)}</span></div>
        <div class="file-note">${escapeHtml(note)}</div>
      </section>`;
}

function renderInspection(inspect = {}) {
  const entries = Object.entries(inspect);

  if (entries.length === 0) {
    return '';
  }

  return `<section class="card inspection">
      <h2>Inspection paths</h2>
      <dl>${entries.map(([key, value]) => (
        `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`
      )).join('')}</dl>
    </section>`;
}

function projectFileHref(path, base) {
  return `${base}${path.split('/').map((part) => encodePathPart(part)).join('/')}`;
}

function safeRelativeHrefBase(value) {
  if (
    typeof value !== 'string'
    || !value
    || value.startsWith('/')
    || value.startsWith('\\')
    || value.includes('\\')
    || /^[a-z][a-z0-9+.-]*:/i.test(value)
    || value.split('/').some((part) => part === '.' || part === '..')
    || !/^[a-z0-9._~/-]+$/i.test(value)
  ) {
    return null;
  }

  return value;
}

function encodePathPart(value) {
  if (value === '.') {
    return '%2E';
  }

  if (value === '..') {
    return '%2E%2E';
  }

  return encodeURIComponent(value);
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function summarizeErrorMessage(error) {
  const message = error.message ?? String(error);

  return message.split(/\r?\n/, 1)[0] || 'The scenario stopped with an error.';
}

async function writeArtifact(path, content, label, errors) {
  try {
    await writeFile(path, content);
    return true;
  } catch (error) {
    errors.push(`Could not write ${label}: ${error.message}`);
    return false;
  }
}
