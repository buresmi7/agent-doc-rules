import {
  maxReportDocumentBytes,
  maxReportErrorMessageBytes,
  maxReportErrorNameBytes,
  maxReportWarningBytes,
  maxReportWarnings,
  reportFormat,
  reportFormatVersion,
  validateScenarioReport,
} from '@buresmi7/agent-e2e-report';
import { randomUUID } from 'node:crypto';
import { open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export {
  maxReportDocumentBytes,
  maxReportErrorMessageBytes,
  maxReportErrorNameBytes,
  maxReportWarningBytes,
  maxReportWarnings,
  reportFormat,
  reportFormatVersion,
  validateScenarioReport,
};

export const reportFileName = 'report.json';
export const defaultMaxReportDocumentBytes = maxReportDocumentBytes;
export const reportErrorRecoveryReserveBytes = 256 * 1024;

export function createScenarioReport({
  scenarioName,
  scenarioSource = 'scenario.json',
  runner = 'unknown',
  agentMetadata = null,
  skillsCliVersion = null,
  skillPackage = null,
  passThreshold = 0.8,
  turns = [],
  inspect = {},
} = {}) {
  return {
    format: reportFormat,
    formatVersion: reportFormatVersion,
    revision: 0,
    status: 'running',
    stage: 'initializing',
    scenario: {
      name: String(scenarioName ?? 'Agent E2E scenario'),
      source: String(scenarioSource),
    },
    runner: String(runner),
    agent: normalizeAgentMetadata(agentMetadata),
    skillsCliVersion: nullableString(skillsCliVersion),
    skillPackage: skillPackage
      ? {
          name: nullableString(skillPackage.name),
          source: nullableString(skillPackage.source),
          skill: nullableString(skillPackage.skill),
        }
      : null,
    passThreshold: finiteScore(passThreshold),
    turns: turns.map(createReportTurn),
    changes: [],
    evaluation: null,
    error: null,
    warnings: [],
    inspect: normalizeStringRecord(inspect),
  };
}

export function replaceReportTurns(report, turns) {
  report.turns = turns.map(createReportTurn);
  return report.turns;
}

export function setReportAgentMetadata(report, agentMetadata) {
  report.agent = normalizeAgentMetadata(agentMetadata);
  return report.agent;
}

export function applyReportEvaluation(report, judgment, effectivePass) {
  const failedCriteria = Array.isArray(judgment?.failedCriteria)
    ? judgment.failedCriteria.map((criterion) => ({
        id: String(criterion?.id ?? ''),
        reason: String(criterion?.reason ?? ''),
      }))
    : [];
  const failedById = new Map(failedCriteria.map((criterion) => [criterion.id, criterion]));
  const knownCriterionIds = new Set(
    report.turns.flatMap((turn) => turn.criteria.map((criterion) => criterion.id)),
  );
  const score = Number(judgment?.score);
  const consistentPass = Boolean(effectivePass) && failedCriteria.length === 0;
  const outcomeReason = consistentPass
    ? 'passed'
    : failedCriteria.length === 0
        && Boolean(judgment?.pass)
        && score < report.passThreshold
      ? 'score-below-threshold'
      : 'criteria-failed';

  for (const turn of report.turns) {
    for (const criterion of turn.criteria) {
      const failure = failedById.get(criterion.id);

      criterion.status = failure ? 'failed' : 'passed';
      criterion.reason = failure?.reason ?? '';
    }
  }

  report.status = consistentPass ? 'passed' : 'failed';
  report.stage = 'complete';
  report.evaluation = {
    judgePass: Boolean(judgment?.pass),
    effectivePass: consistentPass,
    score: Number.isFinite(score) ? score : null,
    passThreshold: report.passThreshold,
    outcomeReason,
    failedCriteria,
    unknownFailedCriteria: failedCriteria.filter(
      (criterion) => !knownCriterionIds.has(criterion.id),
    ),
    requiredFixes: Array.isArray(judgment?.requiredFixes)
      ? judgment.requiredFixes.map(String)
      : [],
    notes: String(judgment?.notes ?? ''),
  };
  report.error = null;

  return report;
}

export function markReportError(report, error, stage = report.stage) {
  report.status = 'error';
  report.stage = stage;
  report.error = serializeReportError(error);

  for (const turn of report.turns) {
    if (turn.status === 'running') {
      turn.status = 'incomplete';
      turn.error = report.error;
    }
  }

  return report;
}

export function serializeReportError(error) {
  const rawName = typeof error?.name === 'string' && error.name
    ? error.name
    : 'Error';
  const rawMessage = typeof error?.message === 'string'
    ? error.message
    : String(error ?? 'Unknown error');
  const lineEnd = rawMessage.search(/[\r\n]/);
  const firstLine = lineEnd === -1 ? rawMessage : rawMessage.slice(0, lineEnd);
  const name = truncateReportText(rawName, maxReportErrorNameBytes);
  const message = truncateReportText(
    firstLine || 'Unknown error',
    maxReportErrorMessageBytes,
  );

  return { name, message };
}

export function truncateReportWarning(message) {
  return truncateReportText(String(message), maxReportWarningBytes);
}

export async function writeReportJson(outputDir, report, options) {
  return writeReportFile(join(outputDir, reportFileName), report, options);
}

export async function writeReportJsonCheckpoint(outputDir, report, options) {
  return writeReportFileCheckpoint(
    join(outputDir, reportFileName),
    report,
    options,
  );
}

export async function writeReportFile(path, report, {
  maxBytes = defaultMaxReportDocumentBytes,
} = {}) {
  const result = await writeReportFileCheckpoint(path, report, { maxBytes });

  return result.reportPath;
}

async function writeReportFileCheckpoint(path, report, {
  maxBytes = defaultMaxReportDocumentBytes,
} = {}) {
  try {
    validateScenarioReport(report);
  } catch (error) {
    error.code ??= 'ERR_AGENT_E2E_REPORT_CONTRACT';
    throw error;
  }

  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('maxReportDocumentBytes must be a positive integer.');
  }

  const content = `${JSON.stringify(report, null, 2)}\n`;
  const byteLength = Buffer.byteLength(content, 'utf8');

  if (byteLength > maxBytes) {
    const error = new Error(
      `Report document exceeds maxReportDocumentBytes (${byteLength} > ${maxBytes} bytes).`,
    );

    error.code = 'ERR_AGENT_E2E_REPORT_SIZE';
    throw error;
  }

  await writeTextFileAtomically(path, content);
  return {
    reportPath: path,
    persistedReport: JSON.parse(content),
  };
}

export async function writeTextFileAtomically(path, content) {
  const tempPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}-${randomUUID()}.tmp`,
  );
  let handle;

  try {
    handle = await open(tempPath, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tempPath, path);
  } finally {
    await handle?.close().catch(() => {});
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

function createReportTurn(turn = {}) {
  return {
    id: nullableString(turn.id),
    source: nullableString(turn.source),
    status: turn.status ?? 'pending',
    prompt: String(turn.prompt ?? ''),
    response: turn.response === null || turn.response === undefined
      ? null
      : String(turn.response),
    criteria: Array.isArray(turn.criteria)
      ? turn.criteria.map((criterion = {}) => ({
          id: nullableString(criterion.id),
          source: nullableString(criterion.source),
          content: String(criterion.content ?? criterion.text ?? ''),
          status: criterion.status ?? 'not-evaluated',
          reason: String(criterion.reason ?? ''),
        }))
      : [],
    activity: Array.isArray(turn.activity) ? turn.activity : [],
    changes: Array.isArray(turn.changes) ? turn.changes : [],
    error: turn.error ?? null,
  };
}

function normalizeAgentMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value === null || value === undefined ? null : { name: String(value) };
  }

  const metadata = {};

  for (const key of ['name', 'command', 'cliVersion']) {
    if (value[key] !== undefined && value[key] !== null) {
      metadata[key] = String(value[key]);
    }
  }

  if (value.model && typeof value.model === 'object' && !Array.isArray(value.model)) {
    metadata.model = {};

    for (const role of ['agent', 'judge']) {
      const model = value.model[role];

      if (!model || typeof model !== 'object' || Array.isArray(model)) {
        continue;
      }

      metadata.model[role] = {
        name: nullableString(model.name),
        reasoningEffort: nullableString(model.reasoningEffort),
        label: nullableString(model.label),
        source: normalizeStringRecord(model.source),
      };
    }
  }

  return metadata;
}

function normalizeStringRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => (
    entry === undefined || entry === null
      ? []
      : [[String(key), String(entry)]]
  )));
}

function nullableString(value) {
  return value === undefined || value === null ? null : String(value);
}

function finiteScore(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
    ? value
    : null;
}

function truncateReportText(value, maxBytes) {
  const text = String(value);

  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return text;
  }

  const suffix = '... [truncated]';
  const prefixBytes = maxBytes - Buffer.byteLength(suffix, 'utf8');
  let prefix = Buffer.from(text, 'utf8')
    .subarray(0, Math.max(0, prefixBytes))
    .toString('utf8');

  if (prefix.endsWith('\uFFFD')) {
    prefix = prefix.slice(0, -1);
  }

  return `${prefix}${suffix}`;
}
