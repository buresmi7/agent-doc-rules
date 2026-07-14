import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

export async function readScenarioTurns(scenarioDir) {
  const turnsDir = join(scenarioDir, 'turns');
  const promptPath = join(scenarioDir, 'prompt.md');
  const promptInfo = await optionalStat(promptPath);
  const turnsDirInfo = await stat(turnsDir).catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (!turnsDirInfo?.isDirectory()) {
    return [{
      id: 'prompt',
      source: 'prompt.md',
      prompt: await readPromptFile(promptPath),
    }];
  }

  if (promptInfo?.isFile()) {
    throw new Error('Agent scenarios must use either prompt.md or turns/*.md, not both.');
  }

  const files = (await readdir(turnsDir))
    .filter((file) => file.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    throw new Error('Multi-turn scenarios must include at least one turns/*.md file.');
  }

  return Promise.all(files.map(async (file, index) => ({
    id: basename(file, '.md'),
    source: `turns/${file}`,
    prompt: await readPromptFile(join(turnsDir, file), `turn ${index + 1}`),
  })));
}

export function buildTurnPrompt({ currentTurn, previousTurns }) {
  if (previousTurns.length === 0) {
    return currentTurn.prompt;
  }

  return `# Previous Turns

${formatPreviousTurns(previousTurns)}

# Current User Request

${currentTurn.prompt}
`;
}

export function formatTurnNotes(turns) {
  return turns.map((turn, index) => {
    return [
      `Turn ${index + 1} (${turn.source})`,
      `User: ${turn.prompt}`,
      `Files: ${formatFileList(turn.generatedFiles)}`,
      `Notes: ${turn.notes}`,
    ].join('\n');
  }).join('\n\n');
}

function formatPreviousTurns(turns) {
  return turns.map((turn, index) => {
    return `## Turn ${index + 1}: ${turn.source}

User request:

${turn.prompt}

Agent notes:

${turn.notes}

Files changed: ${formatFileList(turn.generatedFiles)}`;
  }).join('\n\n');
}

function formatFileList(files) {
  if (files.length === 0) {
    return 'none';
  }

  return files.map((file) => file.path).join(', ');
}

async function readPromptFile(path, label = 'prompt') {
  const content = (await readFile(path, 'utf8')).trim();

  if (!content) {
    throw new Error(`Scenario ${label} is empty: ${path}`);
  }

  return content;
}

async function optionalStat(path) {
  return stat(path).catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });
}
