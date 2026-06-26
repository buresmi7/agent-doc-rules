import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { parseJsonOutput, runCommand } from './process.mjs';

export const codexAuthFiles = ['auth.json'];

export async function validateAgentRuntime(runtime) {
  if (!['codex', 'ollama'].includes(runtime.runner)) {
    throw new Error(`Unsupported AGENT_TEST_RUNNER: ${runtime.runner}\nSupported runners: codex, ollama`);
  }

  if (runtime.runner === 'codex') {
    assertCodexAvailable(runtime.codexBin);
    return;
  }

  if (!runtime.generatorModel || !runtime.judgeModel) {
    throw new Error(
      'Ollama agent E2E test requires OLLAMA_MODEL or both OLLAMA_GENERATOR_MODEL '
      + 'and OLLAMA_JUDGE_MODEL.\n'
      + 'Example: AGENT_TEST_RUNNER=ollama OLLAMA_MODEL=llama3.1 corepack pnpm run test:agent',
    );
  }

  await assertOllamaAvailable(runtime.ollamaHost);
}

export async function readAgentMetadata(runtime) {
  if (runtime.runner === 'codex') {
    const { stdout } = await runCommand(runtime.codexBin, ['--version'], '', {});

    return {
      name: 'codex',
      command: runtime.codexBin,
      cliVersion: stdout.trim(),
      model: {
        name: runtime.codexModel,
        reasoningEffort: runtime.codexReasoningEffort,
        label: formatModelLabel(runtime.codexModel, runtime.codexReasoningEffort),
        source: {
          name: runtime.codexModelSource,
          reasoningEffort: runtime.codexReasoningEffortSource,
        },
      },
    };
  }

  return {
    name: 'ollama',
    host: runtime.ollamaHost,
    model: {
      generator: runtime.generatorModel,
      judge: runtime.judgeModel,
      label: runtime.generatorModel === runtime.judgeModel
        ? runtime.generatorModel
        : `${runtime.generatorModel} generator / ${runtime.judgeModel} judge`,
    },
  };
}

export async function agentGenerate(runtime, request) {
  if (runtime.runner === 'codex') {
    return codexGenerate(runtime, request);
  }

  const model = request.role.endsWith('-judge') ? runtime.judgeModel : runtime.generatorModel;
  return ollamaGenerate(runtime.ollamaHost, model, request.prompt, request.schema);
}

export async function readCodexConfig() {
  const codexHome = process.env.CODEX_HOME ?? join(homedir(), '.codex');
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
    source: process.env.CODEX_HOME ? '$CODEX_HOME/config.toml' : '~/.codex/config.toml',
    home: codexHome,
  };
}

function formatModelLabel(model, reasoningEffort) {
  return [model, reasoningEffort].filter(Boolean).join(' ') || null;
}

function readTomlString(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm'));

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

async function assertOllamaAvailable(ollamaHost) {
  const response = await fetch(`${ollamaHost}/api/tags`).catch((error) => {
    throw new Error(`Could not reach Ollama at ${ollamaHost}: ${error.message}`);
  });

  if (!response.ok) {
    throw new Error(`Ollama at ${ollamaHost} returned HTTP ${response.status}`);
  }
}

async function ollamaGenerate(ollamaHost, model, prompt, schema) {
  const response = await fetch(`${ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: schema,
      options: {
        temperature: 0,
        num_ctx: 8192,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama generate failed for ${model}: HTTP ${response.status}`);
  }

  const data = await response.json();

  try {
    return JSON.parse(data.response);
  } catch {
    throw new Error(`Model ${model} did not return valid JSON: ${data.response}`);
  }
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

async function codexGenerate(runtime, { role, prompt, schema, cwd }) {
  const tempDir = await mkdtemp(join(tmpdir(), `agent-doc-rules-codex-${role}-`));
  const schemaFile = join(tempDir, 'schema.json');
  const outputFile = join(tempDir, 'output.json');
  const codexHome = await prepareIsolatedCodexHome({
    tempDir,
    sourceCodexHome: runtime.codexConfigHome,
    codexModel: runtime.codexModel,
  });

  await writeFile(schemaFile, JSON.stringify(schema, null, 2));

  const args = buildCodexArgs(runtime, {
    schemaFile,
    outputFile,
    cwd,
  });

  try {
    const { stdout } = await runCommand(runtime.codexBin, args, prompt, {
      cwd,
      env: buildCodexProcessEnv(process.env, codexHome),
    });
    const output = await readFile(outputFile, 'utf8').catch(() => stdout);
    const parsed = parseJsonOutput(output, `${role} Codex response`);

    if (!runtime.keepOutput) {
      await rm(tempDir, { recursive: true, force: true });
    }

    return parsed;
  } catch (error) {
    error.message = `${error.message}\nCodex output directory: ${tempDir}`;
    throw error;
  }
}

export function buildCodexArgs(runtime, { schemaFile, outputFile, cwd }) {
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

  if (runtime.codexModel) {
    args.push('--model', runtime.codexModel);
  }

  if (runtime.codexReasoningEffort) {
    args.push('--config', `model_reasoning_effort=${JSON.stringify(runtime.codexReasoningEffort)}`);
  }

  args.push('--cd', cwd, '-');

  return args;
}

export async function prepareIsolatedCodexHome({ tempDir, sourceCodexHome, codexModel }) {
  const codexHome = join(tempDir, 'codex-home');

  await mkdir(codexHome, { recursive: true });

  if (sourceCodexHome) {
    await copyCodexAuthFiles(sourceCodexHome, codexHome);
  }

  const configLines = [
    '# Generated by agent-doc-rules E2E. Do not load maintainer-local Codex rules here.',
  ];

  if (codexModel) {
    configLines.push(`model = ${JSON.stringify(codexModel)}`);
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
