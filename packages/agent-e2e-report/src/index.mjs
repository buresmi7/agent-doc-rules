export const reportFormat = 'agent-e2e-report';
export const reportFormatVersion = 1;
export const maxReportDocumentBytes = 48 * 1024 * 1024;
export const maxReportErrorMessageBytes = 32 * 1024;
export const maxReportErrorNameBytes = 256;
export const maxReportWarningBytes = 16 * 1024;
export const maxReportWarnings = 64;

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export function validateScenarioReport(report) {
  assertObject(report, 'report');
  assertOnlyKeys(report, [
    'format',
    'formatVersion',
    'revision',
    'status',
    'stage',
    'scenario',
    'runner',
    'agent',
    'skillsCliVersion',
    'skillPackage',
    'passThreshold',
    'turns',
    'changes',
    'evaluation',
    'error',
    'warnings',
    'inspect',
  ], 'report');
  assertEqual(report.format, reportFormat, 'report.format');
  assertEqual(report.formatVersion, reportFormatVersion, 'report.formatVersion');
  assertNonNegativeInteger(report.revision, 'report.revision');
  assertEnum(report.status, ['running', 'passed', 'failed', 'error'], 'report.status');
  assertString(report.stage, 'report.stage');

  assertObject(report.scenario, 'report.scenario');
  assertOnlyKeys(report.scenario, ['name', 'source'], 'report.scenario');
  assertString(report.scenario.name, 'report.scenario.name');
  assertString(report.scenario.source, 'report.scenario.source');
  assertRelativePath(report.scenario.source, 'report.scenario.source');
  assertString(report.runner, 'report.runner');
  validateAgentMetadata(report.agent);
  assertNullableString(report.skillsCliVersion, 'report.skillsCliVersion');
  validateSkillPackage(report.skillPackage);

  if (
    report.passThreshold !== null
    && (
      typeof report.passThreshold !== 'number'
      || !Number.isFinite(report.passThreshold)
      || report.passThreshold < 0
      || report.passThreshold > 1
    )
  ) {
    throw new Error('report.passThreshold must be null or a finite number from 0 to 1.');
  }

  assertArray(report.turns, 'report.turns');
  report.turns.forEach((turn, index) => validateTurn(turn, `report.turns[${index}]`));
  assertUniqueIds(
    report.turns.map((turn) => turn.id),
    'report.turns',
  );
  assertUniqueIds(
    report.turns.flatMap((turn) => turn.criteria.map((criterion) => criterion.id)),
    'report criteria',
  );
  validateChanges(report.changes, 'report.changes');
  validateEvaluation(report.evaluation);
  validateError(report.error, 'report.error');
  validateWarnings(report.warnings);
  validateStringRecord(report.inspect, 'report.inspect');
  validateReportState(report);

  return report;
}

function validateTurn(turn, label) {
  assertObject(turn, label);
  assertOnlyKeys(turn, [
    'id',
    'source',
    'status',
    'prompt',
    'response',
    'criteria',
    'activity',
    'changes',
    'error',
  ], label);
  assertNonEmptyString(turn.id, `${label}.id`);
  assertNullableString(turn.source, `${label}.source`);
  if (turn.source !== null) {
    assertRelativePath(turn.source, `${label}.source`);
  }
  assertEnum(turn.status, ['pending', 'running', 'completed', 'incomplete'], `${label}.status`);
  assertString(turn.prompt, `${label}.prompt`);
  assertNullableString(turn.response, `${label}.response`);
  assertArray(turn.criteria, `${label}.criteria`);
  turn.criteria.forEach((criterion, index) => {
    const criterionLabel = `${label}.criteria[${index}]`;

    assertObject(criterion, criterionLabel);
    assertOnlyKeys(
      criterion,
      ['id', 'source', 'content', 'status', 'reason'],
      criterionLabel,
    );
    assertNonEmptyString(criterion.id, `${criterionLabel}.id`);
    assertNullableString(criterion.source, `${criterionLabel}.source`);
    if (criterion.source !== null) {
      assertRelativePath(criterion.source, `${criterionLabel}.source`);
    }
    assertString(criterion.content, `${criterionLabel}.content`);
    assertEnum(
      criterion.status,
      ['not-evaluated', 'passed', 'failed'],
      `${criterionLabel}.status`,
    );
    assertString(criterion.reason, `${criterionLabel}.reason`);
  });
  assertArray(turn.activity, `${label}.activity`);
  turn.activity.forEach((activity, index) => (
    validateActivity(activity, `${label}.activity[${index}]`)
  ));
  validateChanges(turn.changes, `${label}.changes`);
  validateError(turn.error, `${label}.error`);
  validateTurnState(turn, label);
}

function validateTurnState(turn, label) {
  if (turn.status === 'pending' || turn.status === 'running') {
    if (
      turn.response !== null
      || turn.activity.length > 0
      || turn.changes.length > 0
      || turn.error !== null
    ) {
      throw new Error(`${label} cannot contain results while ${turn.status}.`);
    }

    return;
  }

  if (turn.status === 'completed') {
    if (turn.response === null || turn.error !== null) {
      throw new Error(`${label} must contain a response and no error when completed.`);
    }

    return;
  }

  if (turn.error === null) {
    throw new Error(`${label} must contain an error when incomplete.`);
  }
}

function validateActivity(activity, label) {
  assertObject(activity, label);
  assertEnum(
    activity.type,
    ['command_execution', 'file_change', 'mcp_tool_call', 'web_search'],
    `${label}.type`,
  );

  if (activity.type === 'command_execution') {
    assertOnlyKeys(activity, ['type', 'commandSummary', 'exitCode', 'status'], label);
    assertString(activity.commandSummary, `${label}.commandSummary`);
    if (activity.exitCode !== null && !Number.isInteger(activity.exitCode)) {
      throw new Error(`${label}.exitCode must be null or an integer.`);
    }
    assertNullableString(activity.status, `${label}.status`);
    return;
  }

  if (activity.type === 'file_change') {
    assertOnlyKeys(activity, ['type', 'status', 'changes'], label);
    assertNullableString(activity.status, `${label}.status`);
    assertArray(activity.changes, `${label}.changes`);
    activity.changes.forEach((change, index) => {
      const changeLabel = `${label}.changes[${index}]`;

      assertObject(change, changeLabel);
      assertOnlyKeys(change, ['path', 'kind'], changeLabel);
      assertString(change.path, `${changeLabel}.path`);
      assertRelativePath(change.path, `${changeLabel}.path`);
      assertNullableString(change.kind, `${changeLabel}.kind`);
    });
    return;
  }

  if (activity.type === 'mcp_tool_call') {
    assertOnlyKeys(activity, ['type', 'server', 'tool', 'status'], label);
    assertNullableString(activity.server, `${label}.server`);
    assertNullableString(activity.tool, `${label}.tool`);
    assertNullableString(activity.status, `${label}.status`);
    return;
  }

  assertOnlyKeys(activity, ['type', 'query', 'status'], label);
  assertNullableString(activity.query, `${label}.query`);
  assertNullableString(activity.status, `${label}.status`);
}

function validateChanges(changes, label) {
  assertArray(changes, label);
  changes.forEach((change, index) => {
    const changeLabel = `${label}[${index}]`;

    assertObject(change, changeLabel);
    assertOnlyKeys(
      change,
      ['path', 'status', 'before', 'after', 'patch', 'omission'],
      changeLabel,
    );
    assertString(change.path, `${changeLabel}.path`);
    assertRelativePath(change.path, `${changeLabel}.path`);
    assertEnum(change.status, ['created', 'modified', 'deleted'], `${changeLabel}.status`);
    validateFileVersion(change.before, `${changeLabel}.before`);
    validateFileVersion(change.after, `${changeLabel}.after`);

    if (change.status === 'created' && (change.before !== null || change.after === null)) {
      throw new Error(`${changeLabel} must have only an after version when created.`);
    }

    if (change.status === 'deleted' && (change.before === null || change.after !== null)) {
      throw new Error(`${changeLabel} must have only a before version when deleted.`);
    }

    if (change.status === 'modified' && (change.before === null || change.after === null)) {
      throw new Error(`${changeLabel} must have before and after versions when modified.`);
    }

    const hasPatch = change.patch !== null;
    const hasOmission = change.omission !== null;

    if (hasPatch === hasOmission) {
      throw new Error(`${changeLabel} must contain exactly one of patch or omission.`);
    }

    if (hasPatch) {
      assertObject(change.patch, `${changeLabel}.patch`);
      assertOnlyKeys(change.patch, ['format', 'lines'], `${changeLabel}.patch`);
      assertEqual(change.patch.format, 'unified', `${changeLabel}.patch.format`);
      assertStringArray(change.patch.lines, `${changeLabel}.patch.lines`);

      if (
        [change.before, change.after]
          .filter((version) => version !== null)
          .some((version) => version.kind !== 'text')
      ) {
        throw new Error(`${changeLabel}.patch requires text file versions.`);
      }

      if (
        isSensitiveReportPath(change.path)
        || isSensitiveReportContent(change.patch.lines.join('\n'))
      ) {
        throw new Error(`${changeLabel}.patch must not contain sensitive report data.`);
      }
    }

    if (hasOmission) {
      assertObject(change.omission, `${changeLabel}.omission`);
      assertOnlyKeys(
        change.omission,
        ['reason', 'byteLength'],
        `${changeLabel}.omission`,
      );
      assertEnum(change.omission.reason, [
        'binary',
        'sensitive-path',
        'sensitive-content',
        'empty-file',
        'file-too-large',
        'diff-too-large',
        'report-budget',
      ], `${changeLabel}.omission.reason`);
      if (change.omission.byteLength !== undefined) {
        assertNonNegativeInteger(
          change.omission.byteLength,
          `${changeLabel}.omission.byteLength`,
        );
      }

      if (
        isSensitiveReportPath(change.path)
        && change.omission.reason !== 'sensitive-path'
      ) {
        throw new Error(
          `${changeLabel}.omission.reason must be sensitive-path for this path.`,
        );
      }
    }
  });
}

function validateFileVersion(version, label) {
  if (version === null) {
    return;
  }

  assertObject(version, label);
  assertOnlyKeys(version, ['kind', 'byteLength'], label);
  assertEnum(version.kind, ['text', 'binary', 'omitted'], `${label}.kind`);
  assertNonNegativeInteger(version.byteLength, `${label}.byteLength`);
}

function validateEvaluation(evaluation) {
  if (evaluation === null) {
    return;
  }

  const label = 'report.evaluation';

  assertObject(evaluation, label);
  assertOnlyKeys(evaluation, [
    'judgePass',
    'effectivePass',
    'score',
    'passThreshold',
    'outcomeReason',
    'failedCriteria',
    'unknownFailedCriteria',
    'requiredFixes',
    'notes',
  ], label);
  assertBoolean(evaluation.judgePass, `${label}.judgePass`);
  assertBoolean(evaluation.effectivePass, `${label}.effectivePass`);
  assertNullableScore(evaluation.score, `${label}.score`);
  assertNullableScore(evaluation.passThreshold, `${label}.passThreshold`);

  if (evaluation.score === null || evaluation.passThreshold === null) {
    throw new Error(`${label}.score and passThreshold must be present.`);
  }
  assertEnum(
    evaluation.outcomeReason,
    ['passed', 'score-below-threshold', 'criteria-failed'],
    `${label}.outcomeReason`,
  );
  validateFailedCriteria(evaluation.failedCriteria, `${label}.failedCriteria`);
  validateFailedCriteria(
    evaluation.unknownFailedCriteria,
    `${label}.unknownFailedCriteria`,
  );
  assertStringArray(evaluation.requiredFixes, `${label}.requiredFixes`);
  assertString(evaluation.notes, `${label}.notes`);

  if (evaluation.effectivePass) {
    if (
      !evaluation.judgePass
      || evaluation.outcomeReason !== 'passed'
      || evaluation.score < evaluation.passThreshold
      || evaluation.failedCriteria.length > 0
      || evaluation.unknownFailedCriteria.length > 0
    ) {
      throw new Error(`${label} is inconsistent with an effective pass.`);
    }

    return;
  }

  if (evaluation.outcomeReason === 'passed') {
    throw new Error(`${label}.outcomeReason cannot be passed when effectivePass is false.`);
  }

  if (evaluation.outcomeReason === 'score-below-threshold') {
    if (
      !evaluation.judgePass
      || evaluation.score >= evaluation.passThreshold
      || evaluation.failedCriteria.length > 0
      || evaluation.unknownFailedCriteria.length > 0
    ) {
      throw new Error(`${label} is inconsistent with a score-below-threshold outcome.`);
    }

    return;
  }

  if (evaluation.failedCriteria.length === 0 && evaluation.judgePass) {
    throw new Error(`${label} has no reason for an ineffective judge pass.`);
  }
}

function validateReportState(report) {
  if (report.evaluation !== null) {
    validateEvaluationAgainstReport(report);
  } else {
    const evaluatedCriterion = report.turns
      .flatMap((turn) => turn.criteria)
      .find((criterion) => criterion.status !== 'not-evaluated' || criterion.reason !== '');

    if (evaluatedCriterion) {
      throw new Error('Criteria cannot be evaluated before report.evaluation exists.');
    }
  }

  if (report.status === 'running') {
    if (report.evaluation !== null || report.error !== null) {
      throw new Error('A running report cannot contain an evaluation or error.');
    }

    if (report.turns.some((turn) => turn.status === 'incomplete')) {
      throw new Error('A running report cannot contain an incomplete turn.');
    }

    return;
  }

  if (report.status === 'error') {
    if (report.error === null) {
      throw new Error('An error report must contain report.error.');
    }

    if (report.turns.some((turn) => turn.status === 'running')) {
      throw new Error('An error report cannot contain a running turn.');
    }

    if (
      report.evaluation !== null
      && report.turns.some((turn) => turn.status !== 'completed')
    ) {
      throw new Error('An evaluated error report must contain only completed turns.');
    }

    return;
  }

  if (report.error !== null || report.evaluation === null) {
    throw new Error(`A ${report.status} report must contain an evaluation and no error.`);
  }

  const expectedPass = report.status === 'passed';

  if (report.evaluation.effectivePass !== expectedPass) {
    throw new Error(`report.status ${report.status} disagrees with evaluation.effectivePass.`);
  }

  if (report.turns.some((turn) => turn.status !== 'completed')) {
    throw new Error(`A ${report.status} report must contain only completed turns.`);
  }

  if (expectedPass) {
    const unfinishedCriterion = report.turns
      .flatMap((turn) => turn.criteria)
      .find((criterion) => criterion.status !== 'passed');

    if (unfinishedCriterion) {
      throw new Error('A passed report must mark every criterion as passed.');
    }
  }
}

function validateEvaluationAgainstReport(report) {
  const evaluation = report.evaluation;

  if (evaluation.passThreshold !== report.passThreshold) {
    throw new Error('report.evaluation.passThreshold must equal report.passThreshold.');
  }

  const knownIds = new Set(
    report.turns.flatMap((turn) => turn.criteria.map((criterion) => criterion.id)),
  );
  const expectedUnknown = evaluation.failedCriteria.filter(
    (criterion) => !knownIds.has(criterion.id),
  );

  const unknownCriteriaMatch = evaluation.unknownFailedCriteria.length === expectedUnknown.length
    && evaluation.unknownFailedCriteria.every((criterion, index) => (
      criterion.id === expectedUnknown[index].id
      && criterion.reason === expectedUnknown[index].reason
    ));

  if (!unknownCriteriaMatch) {
    throw new Error(
      'report.evaluation.unknownFailedCriteria must contain the unknown failed criteria.',
    );
  }

  const failedById = new Map(
    evaluation.failedCriteria.map((criterion) => [criterion.id, criterion]),
  );

  for (const turn of report.turns) {
    for (const criterion of turn.criteria) {
      const failure = failedById.get(criterion.id);
      const expectedStatus = failure ? 'failed' : 'passed';
      const expectedReason = failure?.reason ?? '';

      if (criterion.status !== expectedStatus || criterion.reason !== expectedReason) {
        throw new Error(
          `Criterion ${JSON.stringify(criterion.id)} disagrees with report.evaluation.`,
        );
      }
    }
  }
}

function validateWarnings(warnings) {
  assertStringArray(warnings, 'report.warnings');

  if (warnings.length > maxReportWarnings) {
    throw new Error(`report.warnings must contain at most ${maxReportWarnings} entries.`);
  }

  warnings.forEach((warning, index) => {
    assertMaxUtf8Bytes(
      warning,
      maxReportWarningBytes,
      `report.warnings[${index}]`,
    );
  });
}

function validateFailedCriteria(criteria, label) {
  assertArray(criteria, label);
  criteria.forEach((criterion, index) => {
    const criterionLabel = `${label}[${index}]`;

    assertObject(criterion, criterionLabel);
    assertOnlyKeys(criterion, ['id', 'reason'], criterionLabel);
    assertString(criterion.id, `${criterionLabel}.id`);
    assertString(criterion.reason, `${criterionLabel}.reason`);
  });
  assertUniqueIds(criteria.map((criterion) => criterion.id), label);
}

function validateAgentMetadata(agent) {
  if (agent === null) {
    return;
  }

  assertObject(agent, 'report.agent');
  assertOnlyKeys(agent, ['name', 'command', 'cliVersion', 'model'], 'report.agent');
  for (const key of ['name', 'command', 'cliVersion']) {
    if (agent[key] !== undefined) {
      assertString(agent[key], `report.agent.${key}`);
    }
  }

  if (agent.model === undefined) {
    return;
  }

  assertObject(agent.model, 'report.agent.model');
  assertOnlyKeys(agent.model, ['agent', 'judge'], 'report.agent.model');
  for (const role of ['agent', 'judge']) {
    const model = agent.model[role];

    if (model === undefined) {
      continue;
    }

    const label = `report.agent.model.${role}`;

    assertObject(model, label);
    assertOnlyKeys(model, ['name', 'reasoningEffort', 'label', 'source'], label);
    assertNullableString(model.name, `${label}.name`);
    assertNullableString(model.reasoningEffort, `${label}.reasoningEffort`);
    assertNullableString(model.label, `${label}.label`);
    validateStringRecord(model.source, `${label}.source`);
  }
}

function validateSkillPackage(skillPackage) {
  if (skillPackage === null) {
    return;
  }

  assertObject(skillPackage, 'report.skillPackage');
  assertOnlyKeys(
    skillPackage,
    ['name', 'source', 'skill'],
    'report.skillPackage',
  );
  assertNullableString(skillPackage.name, 'report.skillPackage.name');
  assertNullableString(skillPackage.source, 'report.skillPackage.source');
  assertNullableString(skillPackage.skill, 'report.skillPackage.skill');
}

function validateError(error, label) {
  if (error === null) {
    return;
  }

  assertObject(error, label);
  assertOnlyKeys(error, ['name', 'message'], label);
  assertString(error.name, `${label}.name`);
  assertString(error.message, `${label}.message`);
  assertMaxUtf8Bytes(error.name, maxReportErrorNameBytes, `${label}.name`);
  assertMaxUtf8Bytes(error.message, maxReportErrorMessageBytes, `${label}.message`);
}

function validateStringRecord(value, label) {
  assertObject(value, label);
  for (const [key, entry] of Object.entries(value)) {
    assertString(entry, `${label}.${key}`);

    if (label === 'report.inspect') {
      assertRelativePath(entry, `${label}.${key}`);

      if (key === 'project' && entry !== 'project') {
        throw new Error('report.inspect.project must equal "project".');
      }
    }
  }
}

function assertOnlyKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));

  if (unexpected) {
    throw new Error(`${label} contains unexpected field ${JSON.stringify(unexpected)}.`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
}

function assertStringArray(value, label) {
  assertArray(value, label);
  if (value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must contain only strings.`);
  }
}

function assertString(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
}

function assertMaxUtf8Bytes(value, maxBytes, label) {
  if (utf8Encoder.encode(value).byteLength > maxBytes) {
    throw new Error(`${label} must not exceed ${maxBytes} encoded bytes.`);
  }
}

function assertRelativePath(value, label) {
  const normalized = value.replaceAll('\\', '/');

  if (
    value.length === 0
    || normalized.startsWith('/')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
    || normalized.split('/').includes('..')
    || normalized.includes('\0')
  ) {
    throw new Error(`${label} must be a relative path without parent traversal.`);
  }
}

function assertNonEmptyString(value, label) {
  assertString(value, label);

  if (value.length === 0) {
    throw new Error(`${label} must not be empty.`);
  }
}

function assertUniqueIds(ids, label) {
  const seen = new Set();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`${label} contains duplicate id ${JSON.stringify(id)}.`);
    }

    seen.add(id);
  }
}

function assertNullableString(value, label) {
  if (value !== null && typeof value !== 'string') {
    throw new Error(`${label} must be null or a string.`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean.`);
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function assertNullableScore(value, label) {
  if (
    value !== null
    && (
      typeof value !== 'number'
      || !Number.isFinite(value)
      || value < 0
      || value > 1
    )
  ) {
    throw new Error(`${label} must be null or a finite number from 0 to 1.`);
  }
}

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}.`);
  }
}

function assertEqual(value, expected, label) {
  if (value !== expected) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}.`);
  }
}

export function isSensitiveReportPath(path) {
  const normalizedPath = String(path).replaceAll('\\', '/').toLowerCase();
  const segments = normalizedPath.split('/');
  const name = segments.at(-1) ?? '';
  const sensitiveNames = new Set([
    '.git-credentials',
    '.netrc',
    '.npmrc',
    '.pypirc',
    'auth.json',
    'credential.json',
    'credentials.json',
    'secret.json',
    'secret.yaml',
    'secret.yml',
    'secrets.json',
    'secrets.yaml',
    'secrets.yml',
    'token.json',
    'tokens.json',
  ]);

  return name === '.env'
    || name.startsWith('.env.')
    || name === '.envrc'
    || name.startsWith('.envrc.')
    || sensitiveNames.has(name)
    || segments.includes('.ssh')
    || segments.includes('.gnupg')
    || normalizedPath === '.aws/credentials'
    || normalizedPath.endsWith('/.aws/credentials')
    || normalizedPath === '.kube/config'
    || normalizedPath.endsWith('/.kube/config')
    || normalizedPath === '.docker/config.json'
    || normalizedPath.endsWith('/.docker/config.json')
    || name.endsWith('.key')
    || name.endsWith('.pem')
    || name.endsWith('.p12')
    || name.endsWith('.pfx')
    || name.endsWith('.ppk')
    || name.endsWith('.jks')
    || name.endsWith('.keystore');
}

export function isSensitiveReportContent(content) {
  if (!content) {
    return false;
  }

  const text = typeof content === 'string' ? content : utf8Decoder.decode(content);

  return /-----BEGIN (?:PGP PRIVATE KEY BLOCK|(?:[A-Z0-9]+ )*PRIVATE KEY)-----/.test(text);
}
