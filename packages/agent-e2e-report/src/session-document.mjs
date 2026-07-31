export const agentSessionFormat = 'agent-session';
export const agentSessionSchemaVersion = '1.0';

const expectationStatuses = new Set([
  'passed',
  'failed',
  'not-evaluated',
]);

export function createAgentSessionDocument({
  id = null,
  title = 'Agent session',
  status = 'recorded',
  source = { kind: 'unknown' },
  metadata = {},
  turns = [],
  project = { finalChanges: [] },
  evaluation = null,
  annotations = [],
} = {}) {
  const document = {
    format: agentSessionFormat,
    schemaVersion: agentSessionSchemaVersion,
    session: {
      id,
      title,
      status,
      source,
      metadata,
    },
    turns,
    project: {
      finalChanges: [],
      ...project,
    },
    evaluation,
    annotations,
  };

  validateAgentSessionDocument(document);

  return document;
}

export function createE2eSessionDocument({
  summary,
  conversationTurns = [],
  reportChanges = [],
  annotations = [],
}) {
  const failedCriteria = new Map(
    (summary.failedCriteria ?? []).map((criterion) => [criterion.id, criterion]),
  );
  const wasEvaluated = summary.status === 'judged-failure'
    || summary.status === 'judged-pass';
  const evaluationStatus = summary.status === 'runtime-error'
    ? 'error'
    : summary.status === 'judged-pass'
      ? 'passed'
      : 'failed';
  const turns = conversationTurns.map((turn, turnIndex) => {
    const userItemId = `${turn.id}:user`;
    const assistantItemId = `${turn.id}:assistant`;
    const activity = (turn.activity ?? []).map((item, itemIndex) => ({
      id: `${turn.id}:activity:${itemIndex + 1}`,
      ...item,
    }));
    const expectations = (turn.criteria ?? []).map((criterion) => {
      const failure = failedCriteria.get(criterion.id);

      return {
        id: criterion.id,
        text: criterion.content,
        source: criterion.source,
        status: wasEvaluated
          ? failure
            ? 'failed'
            : 'passed'
          : 'not-evaluated',
        reason: failure?.reason ?? '',
        targetItemId: assistantItemId,
      };
    });

    return {
      id: turn.id ?? `turn-${turnIndex + 1}`,
      source: turn.source ?? null,
      status: turn.incomplete ? 'incomplete' : 'completed',
      items: [
        {
          id: userItemId,
          type: 'user_message',
          text: turn.prompt ?? '',
        },
        ...activity,
        {
          id: assistantItemId,
          type: 'assistant_message',
          text: turn.response ?? '',
          phase: 'final',
        },
      ],
      expectations,
      projectChanges: turn.reportChanges ?? [],
    };
  });
  const evidenceAnnotations = createEvidenceAnnotations(turns, failedCriteria);

  return createAgentSessionDocument({
    id: summary.agent?.sessionId ?? null,
    title: summary.scenario ?? 'Agent E2E session',
    status: evaluationStatus,
    source: {
      kind: 'agent-e2e',
      runner: summary.runner ?? null,
      scenario: summary.inspect?.scenario ?? null,
    },
    metadata: {
      agent: summary.agent ?? null,
      stage: summary.stage ?? null,
      inspect: summary.inspect ?? {},
    },
    turns,
    project: {
      filesHrefBase: 'project/',
      finalChanges: reportChanges,
    },
    evaluation: {
      status: evaluationStatus,
      score: summary.score ?? null,
      requiredFixes: summary.requiredFixes ?? [],
      notes: summary.judgeNotes ?? '',
      error: summary.error ?? null,
    },
    annotations: [
      ...annotations,
      ...evidenceAnnotations,
    ],
  });
}

export function importCodexExecJsonl(input, {
  title = 'Codex session',
  prompts = [],
  source = {},
} = {}) {
  const events = Array.isArray(input) ? input : parseJsonLines(input);
  const rawTurns = [];
  let threadId = null;
  let activeTurn = null;

  function ensureTurn(event = {}) {
    if (!activeTurn) {
      activeTurn = {
        id: readValue(event, 'turn_id', 'turnId') ?? `turn-${rawTurns.length + 1}`,
        status: 'recorded',
        items: [],
      };
      rawTurns.push(activeTurn);
    }

    return activeTurn;
  }

  for (const event of events) {
    if (event.type === 'thread.started') {
      threadId = readValue(event, 'thread_id', 'threadId') ?? threadId;
      continue;
    }

    if (event.type === 'turn.started') {
      activeTurn = {
        id: readValue(event, 'turn_id', 'turnId') ?? `turn-${rawTurns.length + 1}`,
        status: 'in-progress',
        items: [],
      };
      rawTurns.push(activeTurn);
      continue;
    }

    if (event.type === 'item.completed' && event.item) {
      const turn = ensureTurn(event);

      turn.items.push(normalizeCodexItem(
        event.item,
        turn.items.length,
        turn.id,
      ));
      continue;
    }

    if (event.type === 'turn.completed') {
      const turn = ensureTurn(event);

      turn.status = event.error ? 'error' : 'completed';
      turn.usage = event.usage ?? null;
      turn.error = event.error ?? null;
      activeTurn = null;
      continue;
    }

    if (event.type === 'error') {
      const turn = ensureTurn(event);

      turn.status = 'error';
      turn.items.push({
        id: `${turn.id}:error:${turn.items.length + 1}`,
        type: 'error',
        text: event.message ?? event.error?.message ?? 'Codex reported an error.',
      });
    }
  }

  if (rawTurns.length === 0) {
    rawTurns.push({
      id: 'turn-1',
      status: 'recorded',
      items: [],
    });
  }

  const promptList = Array.isArray(prompts) ? prompts : [prompts];
  const turns = rawTurns.map((turn, index) => {
    const items = [...turn.items];
    const prompt = promptList[index];

    if (
      typeof prompt === 'string'
      && prompt
      && !items.some((item) => item.type === 'user_message')
    ) {
      items.unshift({
        id: `${turn.id}:user`,
        type: 'user_message',
        text: prompt,
      });
    }

    return {
      ...turn,
      items,
      expectations: [],
      projectChanges: projectChangesFromItems(items),
    };
  });

  return createAgentSessionDocument({
    id: threadId,
    title,
    status: turns.some((turn) => turn.status === 'error') ? 'error' : 'recorded',
    source: {
      kind: 'codex-exec-jsonl',
      ...source,
    },
    turns,
    project: {
      finalChanges: collectSessionProjectChanges(turns),
    },
  });
}

export function importCodexThread(input, {
  title,
  source = {},
} = {}) {
  const thread = unwrapCodexThread(input);

  if (!Array.isArray(thread.turns)) {
    throw new Error('Codex thread input must contain a turns array.');
  }

  const turns = thread.turns.map((turn, turnIndex) => {
    const turnId = turn.id ?? `turn-${turnIndex + 1}`;
    const items = (turn.items ?? []).map((item, itemIndex) => (
      normalizeCodexItem(item, itemIndex, turnId)
    ));

    return {
      id: turnId,
      status: normalizeTurnStatus(turn.status),
      error: turn.error ?? null,
      items,
      expectations: [],
      projectChanges: projectChangesFromItems(items),
    };
  });

  return createAgentSessionDocument({
    id: thread.id ?? readValue(thread, 'thread_id', 'threadId') ?? null,
    title: title ?? thread.name ?? thread.title ?? 'Codex session',
    status: turns.some((turn) => turn.status === 'error') ? 'error' : 'recorded',
    source: {
      kind: 'codex-app-server',
      ...source,
    },
    metadata: {
      cwd: thread.cwd ?? null,
      modelProvider: readValue(thread, 'model_provider', 'modelProvider') ?? null,
    },
    turns,
    project: {
      finalChanges: collectSessionProjectChanges(turns),
    },
  });
}

export function applyScenarioExpectations(sessionDocument, scenario, {
  source = 'scenario.json',
} = {}) {
  validateAgentSessionDocument(sessionDocument);

  if (!scenario || !Array.isArray(scenario.turns)) {
    throw new Error('Scenario overlay must contain a turns array.');
  }

  if (scenario.turns.length !== sessionDocument.turns.length) {
    throw new Error(
      `Scenario has ${scenario.turns.length} turns but the session has`
      + ` ${sessionDocument.turns.length}.`,
    );
  }

  const document = structuredClone(sessionDocument);

  for (const [index, scenarioTurn] of scenario.turns.entries()) {
    const sessionTurn = document.turns[index];

    const userMessage = sessionTurn.items.find((item) => (
      item.type === 'user_message'
    ));

    if (
      typeof scenarioTurn.prompt === 'string'
      && userMessage?.text
      && scenarioTurn.prompt.trim() !== userMessage.text.trim()
    ) {
      throw new Error(
        `Scenario turn ${index + 1} does not match session turn ${index + 1}.`,
      );
    }

    const targetItem = [...sessionTurn.items]
      .reverse()
      .find((item) => item.type === 'assistant_message');
    const entries = Object.entries(scenarioTurn.criteria ?? {});

    sessionTurn.expectations = entries.map(([id, text]) => ({
      id: `${scenarioTurn.id}.${id}`,
      text,
      source: `${source}#/turns/${index}/criteria/${escapeJsonPointer(id)}`,
      status: 'not-evaluated',
      reason: '',
      targetItemId: targetItem?.id ?? null,
    }));
    sessionTurn.scenarioTurnId = scenarioTurn.id;
  }

  return document;
}

export function withSessionAnnotations(sessionDocument, annotations) {
  validateAgentSessionDocument(sessionDocument);

  if (!Array.isArray(annotations)) {
    throw new Error('Session annotations must be an array.');
  }

  const document = structuredClone(sessionDocument);

  document.annotations.push(...annotations);
  validateAgentSessionDocument(document);

  return document;
}

export function validateAgentSessionDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Agent session document must be a JSON object.');
  }

  if (document.format !== agentSessionFormat) {
    throw new Error(`Unsupported agent session format: ${document.format ?? 'missing'}.`);
  }

  if (document.schemaVersion !== agentSessionSchemaVersion) {
    throw new Error(
      `Unsupported agent session schema version: ${document.schemaVersion ?? 'missing'}.`,
    );
  }

  if (!document.session || typeof document.session !== 'object') {
    throw new Error('Agent session document must contain session metadata.');
  }

  if (!Array.isArray(document.turns)) {
    throw new Error('Agent session document must contain a turns array.');
  }

  if (!Array.isArray(document.annotations)) {
    throw new Error('Agent session document must contain an annotations array.');
  }

  if (!document.project || !Array.isArray(document.project.finalChanges)) {
    throw new Error('Agent session document must contain project.finalChanges.');
  }

  const turnIds = new Set();
  const itemIds = new Set();

  for (const turn of document.turns) {
    if (!turn || typeof turn !== 'object' || !Array.isArray(turn.items)) {
      throw new Error('Each agent session turn must contain an items array.');
    }

    if (typeof turn.id !== 'string' || !turn.id) {
      throw new Error('Each agent session turn must have a non-empty string id.');
    }

    if (turnIds.has(turn.id)) {
      throw new Error(`Agent session turn id is duplicated: ${turn.id}.`);
    }

    turnIds.add(turn.id);

    if (!Array.isArray(turn.expectations)) {
      throw new Error('Turn expectations must be an array.');
    }

    if (!Array.isArray(turn.projectChanges)) {
      throw new Error('Turn projectChanges must be an array.');
    }

    for (const item of turn.items) {
      if (!item || typeof item.id !== 'string' || typeof item.type !== 'string') {
        throw new Error('Each agent session item must have string id and type fields.');
      }

      if (itemIds.has(item.id)) {
        throw new Error(`Agent session item id is duplicated: ${item.id}.`);
      }

      itemIds.add(item.id);
    }

    for (const expectation of turn.expectations) {
      if (!expectationStatuses.has(expectation.status)) {
        throw new Error(
          `Unsupported expectation status: ${expectation.status ?? 'missing'}.`,
        );
      }
    }
  }

  return document;
}

export function sessionItemSource(itemId) {
  return `urn:agent-session:item:${encodeURIComponent(itemId)}`;
}

export function sessionFileSource({
  scope = 'final',
  path,
  side = 'after',
}) {
  return `urn:agent-session:file:${encodeURIComponent(scope)}`
    + `:${encodeURIComponent(path)}:${side}`;
}

function normalizeCodexItem(item, index, turnId) {
  const rawType = item.type ?? 'unknown';
  const type = normalizeItemType(rawType);
  const normalized = {
    id: item.id ?? `${turnId}:${type}:${index + 1}`,
    type,
  };

  if (type === 'user_message') {
    normalized.content = normalizeMessageContent(item.content);
    normalized.text = messageText(item);
    return normalized;
  }

  if (type === 'assistant_message') {
    normalized.text = item.text ?? messageText(item);
    normalized.phase = item.phase ?? null;
    return normalized;
  }

  if (type === 'reasoning') {
    normalized.text = item.text ?? item.summary ?? '';
    normalized.summary = item.summary ?? null;
    return normalized;
  }

  if (type === 'command_execution') {
    normalized.command = item.command ?? '';
    normalized.commandSummary = item.commandSummary ?? item.command ?? 'shell command';
    normalized.cwd = item.cwd ?? null;
    normalized.status = item.status ?? null;
    normalized.exitCode = readValue(item, 'exit_code', 'exitCode');
    normalized.durationMs = readValue(item, 'duration_ms', 'durationMs');
    normalized.output = readValue(item, 'aggregated_output', 'aggregatedOutput') ?? null;
    normalized.commandActions = readValue(item, 'command_actions', 'commandActions') ?? [];
    return normalized;
  }

  if (type === 'file_change') {
    normalized.status = item.status ?? null;
    normalized.changes = (item.changes ?? []).map((change) => ({
      path: change.path,
      kind: change.kind ?? null,
      patch: change.diff ?? change.patch ?? null,
    }));
    return normalized;
  }

  if (type === 'mcp_tool_call') {
    normalized.server = item.server ?? null;
    normalized.tool = item.tool ?? item.name ?? null;
    normalized.status = item.status ?? null;
    normalized.arguments = item.arguments ?? null;
    normalized.result = item.result ?? null;
    normalized.error = item.error ?? null;
    return normalized;
  }

  if (type === 'web_search') {
    normalized.status = item.status ?? null;
    normalized.query = item.query ?? null;
    return normalized;
  }

  return {
    ...normalized,
    status: item.status ?? null,
    text: item.text ?? '',
    rawType,
  };
}

function createEvidenceAnnotations(turns, failedCriteria) {
  return turns.flatMap((turn) => (
    (turn.expectations ?? []).flatMap((expectation) => {
      const failure = failedCriteria.get(expectation.id);

      if (!failure || !Array.isArray(failure.evidence)) {
        return [];
      }

      return failure.evidence.flatMap((evidence, evidenceIndex) => {
        if (!evidence || typeof evidence.quote !== 'string' || !evidence.quote) {
          return [];
        }

        const targetSource = findEvidenceTarget(turn, expectation, evidence);

        if (!targetSource) {
          return [];
        }

        return [{
          id: `${expectation.id}:evidence:${evidenceIndex + 1}`,
          type: 'Annotation',
          motivation: 'assessing',
          body: {
            type: 'TextualBody',
            value: failure.reason,
            purpose: 'commenting',
            tone: 'failure',
          },
          target: {
            source: targetSource,
            selector: {
              type: 'TextQuoteSelector',
              exact: evidence.quote,
            },
          },
        }];
      });
    })
  ));
}

function findEvidenceTarget(turn, expectation, evidence) {
  if (evidence.target === 'response') {
    const item = turn.items.find((candidate) => (
      candidate.id === expectation.targetItemId
    ));

    return item?.text?.includes(evidence.quote)
      ? sessionItemSource(item.id)
      : null;
  }

  if (evidence.target === 'file' && evidence.path) {
    const change = turn.projectChanges.find((candidate) => (
      candidate.path === evidence.path
    ));
    const content = change?.after?.kind === 'text'
      ? change.after.content
      : null;

    return content?.includes(evidence.quote)
      ? sessionFileSource({
          scope: turn.id,
          path: evidence.path,
          side: 'after',
        })
      : null;
  }

  return null;
}

function normalizeItemType(type) {
  const normalized = type
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();

  if (normalized === 'agent_message') {
    return 'assistant_message';
  }

  return normalized;
}

function normalizeMessageContent(content) {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.map((part) => ({
    ...part,
    type: normalizeItemType(part.type ?? 'unknown'),
  }));
}

function messageText(item) {
  if (typeof item.text === 'string') {
    return item.text;
  }

  if (!Array.isArray(item.content)) {
    return '';
  }

  return item.content
    .map((part) => {
      if (part.text ?? part.value) {
        return part.text ?? part.value;
      }

      const type = normalizeItemType(part.type ?? 'content');

      if (type === 'image') {
        return `[Image${part.url ? `: ${part.url}` : ''}]`;
      }

      if (type === 'local_image') {
        return `[Local image${part.path ? `: ${part.path}` : ''}]`;
      }

      if (type === 'skill') {
        return `[Skill${part.name ? `: ${part.name}` : ''}]`;
      }

      return `[${type.replaceAll('_', ' ')}]`;
    })
    .filter(Boolean)
    .join('\n');
}

function projectChangesFromItems(items) {
  return items
    .filter((item) => item.type === 'file_change')
    .flatMap((item) => item.changes ?? [])
    .map((change) => ({
      path: change.path,
      status: normalizeFileStatus(change.kind),
      patch: change.patch ?? null,
    }));
}

function collectSessionProjectChanges(turns) {
  const changesByPath = new Map();

  for (const change of turns.flatMap((turn) => turn.projectChanges ?? [])) {
    const previous = changesByPath.get(change.path);
    const status = previous?.status === 'created' && change.status === 'modified'
      ? 'created'
      : change.status;

    changesByPath.set(change.path, {
      ...previous,
      ...change,
      status,
    });
  }

  return [...changesByPath.values()];
}

function normalizeFileStatus(kind) {
  if (['add', 'added', 'create', 'created'].includes(kind)) {
    return 'created';
  }

  if (['delete', 'deleted', 'remove', 'removed'].includes(kind)) {
    return 'deleted';
  }

  return 'modified';
}

function normalizeTurnStatus(status) {
  if (typeof status === 'string') {
    const normalized = status.toLowerCase();

    if (normalized.includes('fail') || normalized.includes('error')) {
      return 'error';
    }

    if (normalized.includes('progress')) {
      return 'in-progress';
    }

    if (normalized.includes('complete')) {
      return 'completed';
    }
  }

  if (status && typeof status === 'object') {
    const type = status.type ?? status.status;

    return normalizeTurnStatus(type);
  }

  return 'recorded';
}

function unwrapCodexThread(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Codex thread input must be a JSON object.');
  }

  return input.thread
    ?? input.result?.thread
    ?? input.result
    ?? input;
}

function parseJsonLines(input) {
  if (typeof input !== 'string') {
    throw new Error('Codex exec input must be a JSONL string or an event array.');
  }

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Codex JSONL contains invalid JSON: ${line}`);
      }
    });
}

function readValue(value, snakeCaseKey, camelCaseKey) {
  return value[snakeCaseKey] ?? value[camelCaseKey] ?? null;
}

function escapeJsonPointer(value) {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
