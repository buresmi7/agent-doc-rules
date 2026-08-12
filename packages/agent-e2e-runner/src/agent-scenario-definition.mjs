import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const legacyEntries = ['turns', 'criteria', 'prompt.md', 'criteria.md'];
const maxCriteriaPerTurn = 256;
const maxScenarioIdBytes = 128;
const maxScenarioFileBytes = 2 * 1024 * 1024;
const maxScenarioTextBytes = 256 * 1024;
const maxScenarioTurns = 16;

export async function readAgentScenarioDefinition(scenarioDir) {
  await rejectLegacyEntries(scenarioDir);

  const path = join(scenarioDir, 'scenario.json');
  const source = 'scenario.json';
  const raw = await readJson(path, source);

  assertPlainObject(raw, `${source} must contain a JSON object.`);
  assertOnlyKeys(raw, ['turns'], source);

  if (!Array.isArray(raw.turns) || raw.turns.length === 0) {
    throw new Error(`${source}.turns must be a non-empty array.`);
  }

  if (raw.turns.length > maxScenarioTurns) {
    throw new Error(`${source}.turns must contain at most ${maxScenarioTurns} turns.`);
  }

  const ids = new Set();
  const turns = raw.turns.map((turn, index) => {
    const pointer = `${source}#/turns/${index}`;

    assertPlainObject(turn, `${pointer} must be a JSON object.`);
    assertOnlyKeys(turn, ['id', 'prompt', 'criteria'], pointer);
    assertId(turn.id, `${pointer}.id`);

    if (ids.has(turn.id)) {
      throw new Error(`${pointer}.id duplicates turn id ${JSON.stringify(turn.id)}.`);
    }

    ids.add(turn.id);

    const prompt = readText(turn.prompt, `${pointer}.prompt`);
    const criteria = readCriteria(turn.criteria, turn.id, pointer);

    return {
      id: turn.id,
      source: pointer,
      prompt,
      criteria,
    };
  });

  return { source, turns };
}

export function formatScenarioCriteria(turns) {
  return turns.map((turn, index) => {
    const criteria = turn.criteria.map((criterion) => (
      `- [${criterion.id}] ${criterion.content.replaceAll('\n', '\n  ')}`
    )).join('\n');

    return `## Turn ${index + 1}: ${turn.id}

Source: ${turn.source}

${criteria}`;
  }).join('\n\n');
}

export function formatTranscript(turns) {
  return turns.map((turn, index) => [
    `Turn ${index + 1} (${turn.id}, ${turn.source})`,
    `User: ${turn.prompt}`,
    `Files: ${formatFileList(turn.changes)}`,
    `Agent: ${turn.response}`,
  ].join('\n')).join('\n\n');
}

function readCriteria(value, turnId, pointer) {
  assertPlainObject(value, `${pointer}.criteria must be a JSON object.`);

  const entries = Object.entries(value);

  if (entries.length === 0) {
    throw new Error(`${pointer}.criteria must contain at least one criterion.`);
  }

  if (entries.length > maxCriteriaPerTurn) {
    throw new Error(
      `${pointer}.criteria must contain at most ${maxCriteriaPerTurn} criteria.`,
    );
  }

  return entries.map(([id, content]) => {
    assertId(id, `${pointer}.criteria key`);

    return {
      id: `${turnId}.${id}`,
      source: `${pointer}/criteria/${escapeJsonPointer(id)}`,
      content: readText(content, `${pointer}.criteria.${id}`),
    };
  });
}

function assertId(value, label) {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    throw new Error(`${label} must be a kebab-case identifier.`);
  }

  if (Buffer.byteLength(value, 'utf8') > maxScenarioIdBytes) {
    throw new Error(`${label} must not exceed ${maxScenarioIdBytes} bytes.`);
  }
}

function readText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  const text = value.trim();

  if (Buffer.byteLength(JSON.stringify(text), 'utf8') > maxScenarioTextBytes) {
    throw new Error(`${label} exceeds the ${maxScenarioTextBytes}-byte report limit.`);
  }

  return text;
}

function assertPlainObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function assertOnlyKeys(value, allowedKeys, label) {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).find((key) => !allowed.has(key));

  if (unknown) {
    throw new Error(`${label} contains unknown property ${JSON.stringify(unknown)}.`);
  }
}

function formatFileList(files) {
  if (files.length === 0) {
    return 'none';
  }

  return files.map((file) => file.path).join(', ');
}

function escapeJsonPointer(value) {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

async function readJson(path, source) {
  let content;

  try {
    content = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Agent scenarios must include ${source}.`);
    }

    throw error;
  }

  if (Buffer.byteLength(content, 'utf8') > maxScenarioFileBytes) {
    throw new Error(`${source} exceeds the ${maxScenarioFileBytes}-byte limit.`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${error.message}`);
  }
}

async function rejectLegacyEntries(scenarioDir) {
  for (const entry of legacyEntries) {
    if (await pathExists(join(scenarioDir, entry))) {
      throw new Error(
        `Agent scenarios use only scenario.json; remove legacy ${entry}.`,
      );
    }
  }
}

async function pathExists(path) {
  return stat(path).then(() => true).catch((error) => {
    if (error.code === 'ENOENT') {
      return false;
    }

    throw error;
  });
}
