import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import {
  applyScenarioExpectations,
  importCodexExecJsonl,
  importCodexThread,
  renderSessionViewer,
  validateAgentSessionDocument,
  withSessionAnnotations,
} from './index.mjs';

const supportedFormats = new Set([
  'auto',
  'agent-session',
  'codex-exec',
  'codex-thread',
]);

export async function runSessionViewerCli(argv = process.argv.slice(2), {
  stdout = process.stdout,
} = {}) {
  const options = parseCliArguments(argv);

  if (options.help) {
    stdout.write(`${usage()}\n`);
    return;
  }

  const inputPath = resolve(options.input);
  const input = await readFile(inputPath, 'utf8');
  let session = parseSessionInput(input, {
    format: options.format,
    title: options.title ?? basename(inputPath),
    prompts: options.prompts,
    source: { path: options.input },
  });

  if (options.scenario) {
    const scenarioPath = resolve(options.scenario);
    const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'));

    session = applyScenarioExpectations(session, scenario, {
      source: options.scenario,
    });
  }

  if (options.annotations) {
    const annotationsPath = resolve(options.annotations);
    const annotationInput = JSON.parse(await readFile(annotationsPath, 'utf8'));
    const annotations = Array.isArray(annotationInput)
      ? annotationInput
      : annotationInput.annotations;

    session = withSessionAnnotations(session, annotations);
  }

  const outputPath = resolve(options.output ?? defaultHtmlPath(inputPath));

  await writeFile(outputPath, renderSessionViewer(session));

  if (options.sessionOutput) {
    await writeFile(
      resolve(options.sessionOutput),
      `${JSON.stringify(session, null, 2)}\n`,
    );
  }

  stdout.write(`Session viewer: ${outputPath}\n`);
}

export function parseSessionInput(input, {
  format = 'auto',
  title,
  prompts = [],
  source = {},
} = {}) {
  if (!supportedFormats.has(format)) {
    throw new Error(`Unsupported input format: ${format}.`);
  }

  if (format === 'codex-exec') {
    return importCodexExecJsonl(input, { title, prompts, source });
  }

  const parsed = parseJson(input, format);

  if (format === 'agent-session') {
    return validateAgentSessionDocument(parsed);
  }

  if (format === 'codex-thread') {
    return importCodexThread(parsed, { title, source });
  }

  if (parsed?.format === 'agent-session') {
    return validateAgentSessionDocument(parsed);
  }

  if (looksLikeCodexThread(parsed)) {
    return importCodexThread(parsed, { title, source });
  }

  if (Array.isArray(parsed) || parsed?.type) {
    return importCodexExecJsonl(
      Array.isArray(parsed) ? parsed : [parsed],
      { title, prompts, source },
    );
  }

  throw new Error(
    'Could not detect the input format. Use --format agent-session, codex-exec, or codex-thread.',
  );
}

function parseCliArguments(argv) {
  const options = {
    format: 'auto',
    prompts: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--help' || value === '-h') {
      options.help = true;
      continue;
    }

    if (value === '--output' || value === '-o') {
      options.output = readArgumentValue(argv, ++index, value);
      continue;
    }

    if (value === '--session-output') {
      options.sessionOutput = readArgumentValue(argv, ++index, value);
      continue;
    }

    if (value === '--format') {
      options.format = readArgumentValue(argv, ++index, value);
      continue;
    }

    if (value === '--scenario') {
      options.scenario = readArgumentValue(argv, ++index, value);
      continue;
    }

    if (value === '--annotations') {
      options.annotations = readArgumentValue(argv, ++index, value);
      continue;
    }

    if (value === '--title') {
      options.title = readArgumentValue(argv, ++index, value);
      continue;
    }

    if (value === '--prompt') {
      options.prompts.push(readArgumentValue(argv, ++index, value));
      continue;
    }

    if (value.startsWith('-')) {
      throw new Error(`Unknown option: ${value}`);
    }

    if (options.input) {
      throw new Error('Pass one session input file.');
    }

    options.input = value;
  }

  if (!options.help && !options.input) {
    throw new Error('Pass a session input file.');
  }

  return options;
}

function parseJson(input, format) {
  try {
    return JSON.parse(input);
  } catch (error) {
    if (format === 'auto') {
      return parseJsonLines(input);
    }

    throw new Error(`Invalid JSON input: ${error.message}`);
  }
}

function parseJsonLines(input) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL input: ${error.message}`);
      }
    });
}

function looksLikeCodexThread(value) {
  return Array.isArray(value?.turns)
    || Array.isArray(value?.thread?.turns)
    || Array.isArray(value?.result?.thread?.turns);
}

function readArgumentValue(argv, index, option) {
  const value = argv[index];

  if (!value || value.startsWith('-')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

function defaultHtmlPath(inputPath) {
  const extension = extname(inputPath);

  return extension
    ? `${inputPath.slice(0, -extension.length)}.html`
    : `${inputPath}.html`;
}

function usage() {
  return `Usage: agent-session-viewer <session-file> [options]

Options:
  --format <auto|agent-session|codex-exec|codex-thread>
  --output, -o <path>       Write the self-contained HTML viewer here
  --session-output <path>   Also write normalized agent-session JSON
  --scenario <path>         Show expectations from an E2E scenario.json
  --annotations <path>      Apply a JSON annotation array
  --prompt <text>           Add a missing user prompt; repeat for more turns
  --title <text>            Override the session title
  --help, -h                Show this help`;
}
