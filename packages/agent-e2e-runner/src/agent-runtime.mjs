import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { parseJsonOutput, runCommand, runCommandCapture } from './process.mjs';

export const codexAuthFiles = ['auth.json'];

export async function validateAgentRuntime(runtime) {
  assertCodexAvailable(runtime.codexBin);
}

export async function readAgentMetadata(runtime) {
  const { stdout } = await runCommand(runtime.codexBin, ['--version'], '', {});

  return {
    name: 'codex',
    command: runtime.codexBin,
    cliVersion: stdout.trim(),
    model: {
      agent: formatModelMetadata({
        name: runtime.codexModel,
        reasoningEffort: runtime.codexReasoningEffort,
        nameSource: runtime.codexModelSource,
        reasoningEffortSource: runtime.codexReasoningEffortSource,
      }),
      judge: formatModelMetadata({
        name: runtime.codexJudgeModel,
        reasoningEffort: runtime.codexJudgeReasoningEffort,
        nameSource: runtime.codexJudgeModelSource,
        reasoningEffortSource: runtime.codexJudgeReasoningEffortSource,
      }),
    },
  };
}

export async function buildAgentRuntimeFromEnv(env = process.env) {
  const codexConfig = await readCodexConfig(env);
  const codexModel = env.CODEX_MODEL ?? codexConfig.model ?? null;
  const codexReasoningEffort = (
    env.CODEX_REASONING_EFFORT
    ?? env.CODEX_MODEL_REASONING_EFFORT
    ?? 'medium'
  );
  const codexJudgeModel = env.CODEX_JUDGE_MODEL ?? codexModel;
  const codexJudgeReasoningEffort = (
    env.CODEX_JUDGE_REASONING_EFFORT
    ?? codexReasoningEffort
  );

  return {
    runner: 'codex',
    codexBin: env.CODEX_BIN ?? 'codex',
    codexModel,
    codexReasoningEffort,
    codexJudgeModel,
    codexJudgeReasoningEffort,
    codexModelSource: env.CODEX_MODEL
      ? 'CODEX_MODEL'
      : codexConfig.model
        ? codexConfig.source
        : null,
    codexReasoningEffortSource: env.CODEX_REASONING_EFFORT
      ? 'CODEX_REASONING_EFFORT'
      : env.CODEX_MODEL_REASONING_EFFORT
        ? 'CODEX_MODEL_REASONING_EFFORT'
        : 'agent-e2e-runner default',
    codexJudgeModelSource: env.CODEX_JUDGE_MODEL
      ? 'CODEX_JUDGE_MODEL'
      : env.CODEX_MODEL
        ? 'CODEX_MODEL'
        : codexConfig.model
          ? codexConfig.source
          : null,
    codexJudgeReasoningEffortSource: env.CODEX_JUDGE_REASONING_EFFORT
      ? 'CODEX_JUDGE_REASONING_EFFORT'
      : env.CODEX_REASONING_EFFORT
        ? 'CODEX_REASONING_EFFORT'
        : env.CODEX_MODEL_REASONING_EFFORT
          ? 'CODEX_MODEL_REASONING_EFFORT'
          : 'agent-e2e-runner default',
    codexConfigHome: codexConfig.home,
  };
}

export async function readCodexConfig(env = process.env) {
  const codexHome = env.CODEX_HOME ?? join(homedir(), '.codex');
  const configPath = join(codexHome, 'config.toml');
  const content = await readFile(configPath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  });
  const rootConfig = content.split(/\n(?=\[)/, 1)[0];

  return {
    model: readTomlString(rootConfig, 'model'),
    source: env.CODEX_HOME ? '$CODEX_HOME/config.toml' : '~/.codex/config.toml',
    home: codexHome,
  };
}

export async function createCodexSession(runtime, {
  cwd,
  outputDir,
  baseEnv = process.env,
  runProcess = runCommandCapture,
}) {
  await mkdir(outputDir, { recursive: true });

  const codexHome = await prepareIsolatedCodexHome({
    tempDir: outputDir,
    sourceCodexHome: runtime.codexConfigHome,
    codexModel: runtime.codexModel,
    sandboxMode: 'workspace-write',
  });
  const env = buildCodexProcessEnv(baseEnv, codexHome);
  let sessionId = null;
  let turnIndex = 0;

  return {
    get sessionId() {
      return sessionId;
    },

    async runTurn(prompt) {
      turnIndex += 1;

      const turnLabel = `turn-${String(turnIndex).padStart(2, '0')}`;
      const responseFile = join(outputDir, `${turnLabel}-response.txt`);
      const stdoutFile = join(outputDir, `${turnLabel}-events.jsonl`);
      const stderrFile = join(outputDir, `${turnLabel}-stderr.txt`);
      const args = buildCodexAgentArgs(runtime, {
        cwd,
        outputFile: responseFile,
        sessionId,
      });
      const result = await runProcess(runtime.codexBin, args, prompt, { cwd, env });

      await writeFile(stdoutFile, result.stdout);
      await writeFile(stderrFile, result.stderr);

      if (result.code !== 0) {
        throw new Error(
          `${runtime.codexBin} ${args.join(' ')} failed with exit ${result.code}`
          + `\n${result.stderr}\n${result.stdout}`,
        );
      }

      const parsedEvents = parseCodexJsonEvents(result.stdout);
      const nextSessionId = parsedEvents.threadId ?? sessionId;

      if (!nextSessionId) {
        throw new Error(`Codex ${turnLabel} output did not include a thread.started event.`);
      }

      if (sessionId && nextSessionId !== sessionId) {
        throw new Error(
          `Codex resumed unexpected session ${nextSessionId}; expected ${sessionId}.`,
        );
      }

      sessionId = nextSessionId;

      const response = await readFile(responseFile, 'utf8')
        .catch(() => parsedEvents.lastAgentMessage ?? '');

      if (!response.trim()) {
        throw new Error(`Codex ${turnLabel} did not return an agent response.`);
      }

      return {
        sessionId,
        response: response.trim(),
        activity: extractCodexActivity(parsedEvents.events),
      };
    },

    async close() {
      await removeCodexAuthFiles(codexHome);
    },
  };
}

export async function judgeAgentOutput(runtime, {
  role,
  prompt,
  schema,
  cwd,
  outputDir,
  baseEnv = process.env,
  runProcess = runCommandCapture,
}) {
  await mkdir(outputDir, { recursive: true });

  const schemaFile = join(outputDir, 'schema.json');
  const responseFile = join(outputDir, 'response.json');
  const stdoutFile = join(outputDir, 'stdout.txt');
  const stderrFile = join(outputDir, 'stderr.txt');
  const codexHome = await prepareIsolatedCodexHome({
    tempDir: outputDir,
    sourceCodexHome: runtime.codexConfigHome,
    codexModel: runtime.codexJudgeModel,
    sandboxMode: 'read-only',
  });

  try {
    await writeFile(schemaFile, JSON.stringify(schema, null, 2));

    const args = buildCodexJudgeArgs(runtime, {
      schemaFile,
      outputFile: responseFile,
      cwd,
    });
    const result = await runProcess(runtime.codexBin, args, prompt, {
      cwd,
      env: buildCodexProcessEnv(baseEnv, codexHome),
    });

    await writeFile(stdoutFile, result.stdout);
    await writeFile(stderrFile, result.stderr);

    if (result.code !== 0) {
      throw new Error(
        `${runtime.codexBin} ${args.join(' ')} failed with exit ${result.code}`
        + `\n${result.stderr}\n${result.stdout}`,
      );
    }

    const output = await readFile(responseFile, 'utf8').catch(() => result.stdout);

    return parseJsonOutput(output, `${role} Codex response`);
  } finally {
    await removeCodexAuthFiles(codexHome);
  }
}

export function buildCodexAgentArgs(runtime, { outputFile, cwd, sessionId = null }) {
  const args = sessionId
    ? [
      'exec',
      'resume',
      '--skip-git-repo-check',
      '--ignore-rules',
      '--json',
      '--output-last-message',
      outputFile,
    ]
    : [
      'exec',
      '--skip-git-repo-check',
      '--ignore-rules',
      '--sandbox',
      'workspace-write',
      '--add-dir',
      join(cwd, '.agents'),
      '--json',
      '--output-last-message',
      outputFile,
      '--color',
      'never',
    ];

  addCodexModelArgs(args, runtime.codexModel, runtime.codexReasoningEffort);

  if (sessionId) {
    args.push(sessionId, '-');
  } else {
    args.push('--cd', cwd, '-');
  }

  return args;
}

export function buildCodexJudgeArgs(runtime, { schemaFile, outputFile, cwd }) {
  const args = [
    'exec',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-rules',
    '--sandbox',
    'read-only',
    '--output-schema',
    schemaFile,
    '--output-last-message',
    outputFile,
    '--color',
    'never',
  ];

  addCodexModelArgs(args, runtime.codexJudgeModel, runtime.codexJudgeReasoningEffort);
  args.push('--cd', cwd, '-');

  return args;
}

export function parseCodexJsonEvents(stdout) {
  const events = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Codex --json output contained invalid JSON: ${line}`);
      }
    });
  const threadEvent = events.find((event) => event.type === 'thread.started');
  const lastAgentMessage = events
    .filter((event) => (
      event.type === 'item.completed'
      && event.item?.type === 'agent_message'
      && typeof event.item.text === 'string'
    ))
    .at(-1)?.item.text;

  return {
    events,
    threadId: threadEvent?.thread_id ?? threadEvent?.threadId ?? null,
    lastAgentMessage: lastAgentMessage ?? null,
  };
}

export function extractCodexActivity(events) {
  return events.flatMap((event) => {
    if (event.type !== 'item.completed' || !event.item) {
      return [];
    }

    const { item } = event;

    if (item.type === 'command_execution' && typeof item.command === 'string') {
      return [{
        type: 'command_execution',
        commandSummary: summarizeCodexCommand(item.command),
        exitCode: Number.isInteger(item.exit_code) ? item.exit_code : null,
        status: item.status ?? null,
      }];
    }

    if (item.type === 'file_change' && Array.isArray(item.changes)) {
      return [{
        type: 'file_change',
        status: item.status ?? null,
        changes: item.changes.map((change) => ({
          path: change.path,
          kind: change.kind ?? null,
        })),
      }];
    }

    if (item.type === 'mcp_tool_call') {
      return [{
        type: 'mcp_tool_call',
        server: item.server ?? null,
        tool: item.tool ?? item.name ?? null,
        status: item.status ?? null,
      }];
    }

    if (item.type === 'web_search') {
      return [{
        type: 'web_search',
        status: item.status ?? null,
      }];
    }

    return [];
  });
}

export function summarizeCodexCommand(command) {
  const payload = extractShellPayload(command);

  if (payload === null) {
    return 'shell command';
  }

  const segments = splitShellCommand(payload);

  if (!segments || segments.length === 0) {
    return 'shell command';
  }

  if (segments.slice(1).some(({ operator }) => operator !== '&&')) {
    return 'shell command';
  }

  if (segments.length > 1) {
    const leadingVerifications = [];

    for (const { command: segment } of segments) {
      const verification = summarizeVerificationSegment(segment);

      if (verification) {
        leadingVerifications.push(verification);
        continue;
      }

      if (leadingVerifications.length === 0 && isSafeVerificationPrefix(segment)) {
        continue;
      }

      break;
    }

    return leadingVerifications.length > 0
      ? leadingVerifications.join(' && ')
      : 'shell command';
  }

  const summary = summarizeShellSegment(segments[0].command);

  return summary === 'shell command'
    || unsafeStandaloneCommands.has(summary.split(' ')[0])
    ? 'shell command'
    : summary;
}

const unsafeStandaloneCommands = new Set([
  '!', '.', 'break', 'builtin', 'case', 'command', 'continue', 'coproc',
  'do', 'done', 'elif', 'else', 'enable', 'esac', 'eval', 'exec', 'exit',
  'fi', 'for', 'function', 'hash', 'if', 'logout', 'return', 'select', 'set',
  'source', 'suspend', 'then', 'time', 'trap', 'until', 'while',
]);

function extractShellPayload(command) {
  const normalizedCommand = trimShellWhitespace(command);
  const wrapper = normalizedCommand.match(
    /^(?:[A-Za-z]:)?[\\/]?(?:(?:[A-Za-z0-9._+-]+[\\/])*)(?:ba|z|fi)?sh[ \t]+-lc[ \t]+/,
  );

  if (!wrapper) {
    return normalizedCommand;
  }

  const wrappedPayload = trimShellWhitespace(normalizedCommand.slice(wrapper[0].length));
  const quote = wrappedPayload[0];

  if (
    (quote !== "'" && quote !== '"')
    || wrappedPayload.at(-1) !== quote
    || wrappedPayload.slice(1, -1).includes(quote)
  ) {
    return null;
  }

  return wrappedPayload.slice(1, -1);
}

function summarizeShellSegment(payload) {
  const normalizedPayload = trimShellWhitespace(payload).replace(/[ \t\n]+/g, ' ');
  const verification = summarizeVerificationSegment(normalizedPayload);

  if (verification) {
    return verification;
  }

  const python = normalizedPayload.match(
    /^(python(?:3(?:\.\d+)?)?) +([^ '"`]+)$/,
  );

  if (python) {
    const scriptName = safePortableBasename(python[2]);
    return python[2].startsWith('-') || !scriptName
      ? python[1]
      : `${python[1]} ${scriptName}`;
  }

  const node = normalizedPayload.match(/^node +([^ '"`]+)$/);

  if (node) {
    const scriptName = safePortableBasename(node[1]);
    return node[1].startsWith('-') || !scriptName
      ? 'node'
      : `node ${scriptName}`;
  }

  const npx = normalizedPayload.match(/^npx +([^ '"`]+)$/);

  if (npx) {
    const executableName = safePortableBasename(npx[1]);
    return npx[1].startsWith('-') || !executableName
      ? 'npx'
      : `npx ${executableName}`;
  }

  const executable = normalizedPayload.match(/^([^ '"`;|&]+)(?= |$)/)?.[1];
  const executableName = executable ? safePortableBasename(executable) : null;

  return executable && executableName && !executable.includes('=')
    ? executableName
    : 'shell command';
}

function summarizeVerificationSegment(payload) {
  const normalizedPayload = trimShellWhitespace(payload).replace(/[ \t\n]+/g, ' ');
  const packageManager = normalizedPayload.match(
    /^(?:corepack +)?(npm|pnpm|yarn|bun) +(test|run +[A-Za-z0-9:._-]+)$/,
  );

  if (packageManager) {
    return `${packageManager[1]} ${packageManager[2]}`;
  }

  return normalizedPayload === 'node --test' ? normalizedPayload : null;
}

function isSafeVerificationPrefix(payload) {
  const normalizedPayload = trimShellWhitespace(payload).replace(/[ \t\n]+/g, ' ');
  const pathList = String.raw`[A-Za-z0-9@._+\/-]+(?: +[A-Za-z0-9@._+\/-]+)*`;

  return new RegExp(`^git diff(?: +--check)?(?: +-- +${pathList})?$`).test(normalizedPayload)
    || new RegExp(`^git status(?: +--short)?(?: +-- +${pathList})?$`).test(normalizedPayload);
}

function splitShellCommand(payload) {
  if (
    payload.includes('$(')
    || payload.includes('`')
    || payload.includes("$'")
    || payload.includes('$"')
    || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(payload)
  ) {
    return null;
  }

  const segments = [];
  let command = '';
  let pendingOperator = null;
  let quote = null;
  let escaped = false;

  const pushCommand = (nextOperator) => {
    const trimmed = trimShellWhitespace(command);

    if (!trimmed) {
      return false;
    }

    segments.push({ operator: pendingOperator, command: trimmed });
    command = '';
    pendingOperator = nextOperator;
    return true;
  };

  for (let index = 0; index < payload.length; index += 1) {
    const character = payload[index];
    const next = payload[index + 1];

    if (escaped) {
      command += character;
      escaped = false;
      continue;
    }

    if (quote) {
      command += character;

      if (character === '\\' && quote !== "'") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      command += character;
      continue;
    }

    if (character === '\\') {
      return null;
    }

    if (
      character === '<'
      || character === '>'
      || character === '('
      || character === ')'
      || character === '{'
      || character === '}'
      || character === '['
      || character === ']'
      || (character === '#' && /[\s;|&]/.test(payload[index - 1] ?? ' '))
    ) {
      return null;
    }

    let operator = null;

    if ((character === '&' && next === '&') || (character === '|' && next === '|')) {
      operator = `${character}${next}`;
      index += 1;
    } else if (character === '|' && next === '&') {
      operator = '|&';
      index += 1;
    } else if (character === ';' || character === '|' || character === '\n') {
      operator = character === '\n' ? ';' : character;
    } else if (character === '&') {
      operator = character;
    }

    if (operator) {
      if (character === '\n' && !trimShellWhitespace(command)) {
        continue;
      }

      if (!pushCommand(operator)) {
        return null;
      }

      continue;
    }

    command += character;
  }

  if (quote || escaped) {
    return null;
  }

  if (trimShellWhitespace(command)) {
    pushCommand(null);
  } else if (pendingOperator && pendingOperator !== ';') {
    return null;
  }

  return segments;
}

function portableBasename(path) {
  return basename(path.replaceAll('\\', '/'));
}

function safePortableBasename(path) {
  const name = portableBasename(path);
  return /^[A-Za-z0-9@._+-]+$/.test(name) ? name : null;
}

function trimShellWhitespace(value) {
  return value.replace(/^[ \t\n]+|[ \t\n]+$/g, '');
}

export async function prepareIsolatedCodexHome({
  tempDir,
  sourceCodexHome,
  codexModel,
  sandboxMode,
}) {
  const codexHome = join(tempDir, 'codex-home');

  await mkdir(codexHome, { recursive: true });

  if (sourceCodexHome) {
    await copyCodexAuthFiles(sourceCodexHome, codexHome);
  }

  const configLines = [
    '# Generated by agent-e2e-runner. Do not load maintainer-local Codex rules here.',
    'project_root_markers = ["package.json", "pnpm-workspace.yaml"]',
  ];

  if (codexModel) {
    configLines.push(`model = ${JSON.stringify(codexModel)}`);
  }

  if (sandboxMode) {
    configLines.push(`sandbox_mode = ${JSON.stringify(sandboxMode)}`);
  }

  await writeFile(join(codexHome, 'config.toml'), `${configLines.join('\n')}\n`);

  return codexHome;
}

export function buildCodexProcessEnv(baseEnv, codexHome) {
  return {
    ...baseEnv,
    CODEX_HOME: codexHome,
    NO_COLOR: baseEnv.NO_COLOR ?? '1',
  };
}

function addCodexModelArgs(args, model, reasoningEffort) {
  if (model) {
    args.push('--model', model);
  }

  if (reasoningEffort) {
    args.push('--config', `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
  }
}

function formatModelMetadata({
  name,
  reasoningEffort,
  nameSource,
  reasoningEffortSource,
}) {
  return {
    name,
    reasoningEffort,
    label: [name, reasoningEffort].filter(Boolean).join(' ') || null,
    source: {
      name: nameSource,
      reasoningEffort: reasoningEffortSource,
    },
  };
}

function readTomlString(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm'));

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function assertCodexAvailable(codexBin) {
  const result = spawnSync(codexBin, ['--version'], {
    encoding: 'utf8',
  });

  if (result.error) {
    throw new Error(`Could not run ${codexBin}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${codexBin} --version failed: ${result.stderr || result.stdout}`);
  }
}

async function copyCodexAuthFiles(sourceCodexHome, targetCodexHome) {
  for (const file of codexAuthFiles) {
    try {
      await copyFile(join(sourceCodexHome, file), join(targetCodexHome, file));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

async function removeCodexAuthFiles(codexHome) {
  await Promise.all(codexAuthFiles.map((file) => (
    rm(join(codexHome, file), { force: true })
  )));
}
