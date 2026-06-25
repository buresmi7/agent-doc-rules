import { mkdtemp, rm, cp, mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const e2eRoot = join(repoRoot, 'e2e');
const projectFixtureDir = process.env.SCENARIO_DIR
  ? resolve(process.env.SCENARIO_DIR)
  : process.cwd();
const scenarioDir = dirname(projectFixtureDir);
const scenarioName = process.env.SCENARIO_NAME ?? basename(scenarioDir);
const snapshotDirName = readSnapshotDirName();
const scenarioRequire = createRequire(join(projectFixtureDir, 'package.json'));
const skillPackageJson = scenarioRequire.resolve('@agent-doc-rules/skill/package.json');
const skillSource = dirname(skillPackageJson);
const skillName = 'agent-doc-rules';
const skillsCliVersion = process.env.SKILLS_CLI_VERSION ?? '1.5.12';
const runner = process.env.AGENT_TEST_RUNNER ?? (
  process.env.OLLAMA_MODEL || process.env.OLLAMA_GENERATOR_MODEL || process.env.OLLAMA_JUDGE_MODEL
    ? 'ollama'
    : 'codex'
);
const codexBin = process.env.CODEX_BIN ?? 'codex';
const ollamaHost = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const generatorModel = process.env.OLLAMA_GENERATOR_MODEL ?? process.env.OLLAMA_MODEL;
const judgeModel = process.env.OLLAMA_JUDGE_MODEL ?? process.env.OLLAMA_MODEL;
const updateAgentSnapshots = process.env.UPDATE_AGENT_SNAPSHOTS === '1';
const codexConfig = runner === 'codex' ? await readCodexConfig() : {};
const codexModel = process.env.CODEX_MODEL ?? codexConfig.model ?? null;
const defaultCodexReasoningEffort = 'medium';
const codexReasoningEffort = (
  process.env.CODEX_REASONING_EFFORT
  ?? process.env.CODEX_MODEL_REASONING_EFFORT
  ?? defaultCodexReasoningEffort
);
const codexModelSource = process.env.CODEX_MODEL
  ? 'CODEX_MODEL'
  : codexConfig.model
    ? codexConfig.source
    : null;
const codexReasoningEffortSource = (
  process.env.CODEX_REASONING_EFFORT
    ? 'CODEX_REASONING_EFFORT'
    : process.env.CODEX_MODEL_REASONING_EFFORT
      ? 'CODEX_MODEL_REASONING_EFFORT'
      : 'agent-doc-rules default'
);

const generateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    files: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['files', 'notes'],
};

const judgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    failedCriteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['id', 'reason'],
      },
    },
    requiredFixes: {
      type: 'array',
      items: { type: 'string' },
    },
    notes: { type: 'string' },
  },
  required: ['pass', 'score', 'failedCriteria', 'requiredFixes', 'notes'],
};

if (!['codex', 'ollama'].includes(runner)) {
  console.error(`Unsupported AGENT_TEST_RUNNER: ${runner}`);
  console.error('Supported runners: codex, ollama');
  process.exit(1);
}

if (runner === 'codex') {
  assertCodexAvailable();
}

if (runner === 'ollama') {
  if (!generatorModel || !judgeModel) {
    console.error('Ollama agent E2E test requires OLLAMA_MODEL or both OLLAMA_GENERATOR_MODEL and OLLAMA_JUDGE_MODEL.');
    console.error('Example: AGENT_TEST_RUNNER=ollama OLLAMA_MODEL=llama3.1 corepack pnpm run test:agent');
    process.exit(1);
  }

  await assertOllamaAvailable();
}

const skillReference = await readSkillReference();
const ollamaSkillContext = runner === 'ollama' ? await readSkillUsePrompt() : '';
const judgePromptTemplate = await readFile(join(e2eRoot, 'prompts/judge-agents.md'), 'utf8');
const agentMetadata = await readAgentMetadata();

const result = await runScenario().catch((error) => ({
  scenario: scenarioName,
  pass: false,
  notes: error.stack ?? error.message,
  failedCriteria: [{ id: 'HARNESS', reason: error.message }],
  requiredFixes: ['Fix the test harness or model setup.'],
}));

if (!result.pass) {
  console.error('Agent E2E tests failed:');
  console.error(`\n## ${result.scenario}`);
  console.error(`score: ${result.score ?? 'n/a'}`);
  console.error(result.notes);

  for (const criterion of result.failedCriteria ?? []) {
    console.error(`- ${criterion.id}: ${criterion.reason}`);
  }

  for (const fix of result.requiredFixes ?? []) {
    console.error(`fix: ${fix}`);
  }

  if (result.outputDir) {
    console.error(`output: ${result.outputDir}`);
  }

  process.exit(1);
}

console.log(`Agent E2E test passed for ${scenarioName}.`);

async function runScenario() {
  const tempDir = await mkdtemp(join(tmpdir(), `agent-doc-rules-${scenarioName}-`));
  const projectDir = join(tempDir, 'project');

  await cp(projectFixtureDir, projectDir, { recursive: true });
  await installSkill(projectDir);

  const scenarioPrompt = await readFile(join(scenarioDir, 'prompt.md'), 'utf8');
  const projectFilesBefore = await readProjectFiles(projectDir);
  const prompt = buildGeneratePrompt({
    scenarioPrompt,
    projectFiles: projectFilesBefore,
    skillContext: ollamaSkillContext,
  });

  const generated = await agentGenerate({
    role: `${scenarioName}-generator`,
    prompt,
    schema: generateSchema,
    cwd: projectDir,
  });
  const generatedFiles = normalizeGeneratedFiles(generated.files);
  await writeGeneratedFiles(projectDir, generatedFiles);

  const criteria = await readFile(join(scenarioDir, 'criteria.md'), 'utf8');
  const projectFilesAfter = await readProjectFiles(projectDir);
  const judgePrompt = render(judgePromptTemplate, {
    criteria,
    skillReference,
    originalProjectFiles: projectFilesBefore,
    projectFiles: projectFilesAfter,
    generatedFiles: formatGeneratedFiles(generatedFiles),
  });

  const judgment = await agentGenerate({
    role: `${scenarioName}-judge`,
    prompt: judgePrompt,
    schema: judgeSchema,
    cwd: projectDir,
  });
  const pass = Boolean(judgment.pass) && Number(judgment.score) >= 0.8;

  if (pass && updateAgentSnapshots) {
    await writeScenarioSnapshot({ generatedFiles, generated, judgment });
  }

  if (pass && !process.env.KEEP_TEST_OUTPUT) {
    await rm(tempDir, { recursive: true, force: true });
  }

  return {
    scenario: scenarioName,
    ...judgment,
    pass,
    outputDir: pass ? undefined : tempDir,
  };
}

async function installSkill(projectDir) {
  const npmCache = await mkdtemp(join(tmpdir(), 'agent-doc-rules-npm-cache-'));

  try {
    await runCommand('npx', [
      '-y',
      `skills@${skillsCliVersion}`,
      'add',
      skillSource,
      '--skill',
      skillName,
      '-a',
      'codex',
      '-y',
      '--copy',
    ], '', {
      cwd: projectDir,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
        npm_config_cache: npmCache,
      },
    });
  } finally {
    if (!process.env.KEEP_TEST_OUTPUT) {
      await rm(npmCache, { recursive: true, force: true });
    }
  }

  await assertFile(join(projectDir, '.agents/skills/agent-doc-rules/SKILL.md'));
  await assertFile(join(projectDir, 'skills-lock.json'));
}

function buildGeneratePrompt({ scenarioPrompt, projectFiles, skillContext }) {
  const optionalSkillContext = skillContext
    ? `\n# Skill Context For Non-Skill Runner\n\n${skillContext}\n`
    : '';

  return `# Scenario Prompt

Use $agent-doc-rules for this task.

${scenarioPrompt.trim()}

# Harness Instructions

Return JSON only with this shape:

\`\`\`json
{
  "files": [
    {
      "path": "relative/path.md",
      "content": "complete file content"
    }
  ],
  "notes": "short implementation note"
}
\`\`\`

Rules:

- Include only files you create or change.
- If no file changes are needed, return an empty \`files\` array.
- Use repository-relative file paths.
- Do not use absolute paths or parent-directory traversal.
- Wrap Markdown prose and bullets so lines stay under 100 characters.
- Format Markdown tables with spaces around each pipe separator.
- The target project has installed \`agent-doc-rules\` at
  \`.agents/skills/agent-doc-rules/\`.
- Preserve facts from the project files. Do not invent repository details.
${optionalSkillContext}
Project files:

\`\`\`text
${projectFiles}
\`\`\`
`;
}

async function writeScenarioSnapshot({ generatedFiles, generated, judgment }) {
  const snapshotDir = join(scenarioDir, snapshotDirName);
  const filesDir = join(snapshotDir, 'files');
  await mkdir(snapshotDir, { recursive: true });
  await rm(filesDir, { recursive: true, force: true });
  await mkdir(filesDir, { recursive: true });

  for (const file of generatedFiles) {
    const target = join(filesDir, file.path);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }

  await writeFile(
    join(snapshotDir, 'generated-files.json'),
    `${JSON.stringify(generatedFiles, null, 2)}\n`,
  );
  await writeFile(
    join(snapshotDir, 'metadata.json'),
    `${JSON.stringify({
      scenario: scenarioName,
      runner,
      agent: agentMetadata,
      skillsCliVersion,
      skillPackage: {
        name: '@agent-doc-rules/skill',
        source: relative(repoRoot, skillSource),
      },
    }, null, 2)}\n`,
  );
  await writeFile(
    join(snapshotDir, 'judgment.json'),
    `${JSON.stringify({
      scenario: scenarioName,
      runner,
      pass: Boolean(judgment.pass),
      score: Number(judgment.score),
      failedCriteria: judgment.failedCriteria,
      requiredFixes: judgment.requiredFixes,
      generatorNotes: generated.notes,
      judgeNotes: judgment.notes,
    }, null, 2)}\n`,
  );
}

function readSnapshotDirName() {
  const value = process.env.AGENT_E2E_SNAPSHOT_DIR ?? 'snapshot';

  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`AGENT_E2E_SNAPSHOT_DIR must be a directory name, got ${JSON.stringify(value)}`);
  }

  return value;
}

async function readAgentMetadata() {
  if (runner === 'codex') {
    const { stdout } = await runCommand(codexBin, ['--version'], '', {});

    return {
      name: 'codex',
      command: codexBin,
      cliVersion: stdout.trim(),
      model: {
        name: codexModel,
        reasoningEffort: codexReasoningEffort,
        label: formatModelLabel(codexModel, codexReasoningEffort),
        source: {
          name: codexModelSource,
          reasoningEffort: codexReasoningEffortSource,
        },
      },
    };
  }

  return {
    name: 'ollama',
    host: ollamaHost,
    model: {
      generator: generatorModel,
      judge: judgeModel,
      label: generatorModel === judgeModel
        ? generatorModel
        : `${generatorModel} generator / ${judgeModel} judge`,
    },
  };
}

function formatModelLabel(model, reasoningEffort) {
  return [model, reasoningEffort].filter(Boolean).join(' ') || null;
}

async function readCodexConfig() {
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
  };
}

function readTomlString(content, key) {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm'));

  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

async function assertOllamaAvailable() {
  const response = await fetch(`${ollamaHost}/api/tags`).catch((error) => {
    throw new Error(`Could not reach Ollama at ${ollamaHost}: ${error.message}`);
  });

  if (!response.ok) {
    throw new Error(`Ollama at ${ollamaHost} returned HTTP ${response.status}`);
  }
}

async function ollamaGenerate(model, prompt, schema) {
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

function assertCodexAvailable() {
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

async function agentGenerate({ role, prompt, schema, cwd }) {
  if (runner === 'codex') {
    return codexGenerate({ role, prompt, schema, cwd });
  }

  const model = role.endsWith('-judge') ? judgeModel : generatorModel;
  return ollamaGenerate(model, prompt, schema);
}

async function codexGenerate({ role, prompt, schema, cwd }) {
  const tempDir = await mkdtemp(join(tmpdir(), `agent-doc-rules-codex-${role}-`));
  const schemaFile = join(tempDir, 'schema.json');
  const outputFile = join(tempDir, 'output.json');

  await writeFile(schemaFile, JSON.stringify(schema, null, 2));

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

  if (codexModel) {
    args.push('--model', codexModel);
  }

  if (codexReasoningEffort) {
    args.push('--config', `model_reasoning_effort=${JSON.stringify(codexReasoningEffort)}`);
  }

  args.push('--cd', cwd, '-');

  try {
    const { stdout } = await runCommand(codexBin, args, prompt, { cwd });
    const output = await readFile(outputFile, 'utf8').catch(() => stdout);
    const parsed = parseJsonOutput(output, `${role} Codex response`);

    if (!process.env.KEEP_TEST_OUTPUT) {
      await rm(tempDir, { recursive: true, force: true });
    }

    return parsed;
  } catch (error) {
    error.message = `${error.message}\nCodex output directory: ${tempDir}`;
    throw error;
  }
}

function runCommand(command, args, input, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const { env, ...spawnOptions } = options;
    const child = spawn(command, args, {
      ...spawnOptions,
      env: env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit ${code}\n${stderr}\n${stdout}`));
    });

    child.stdin.end(input);
  });
}

function parseJsonOutput(value, label) {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fenced) {
      return JSON.parse(fenced[1]);
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  }

  throw new Error(`${label} did not contain valid JSON: ${trimmed}`);
}

async function readSkillUsePrompt() {
  const npmCache = await mkdtemp(join(tmpdir(), 'agent-doc-rules-npm-cache-'));

  try {
    const { stdout } = await runCommand('npx', [
      '-y',
      `skills@${skillsCliVersion}`,
      'use',
      skillSource,
      '--skill',
      skillName,
    ], '', {
      cwd: scenarioDir,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
        npm_config_cache: npmCache,
      },
    });

    return `${stdout.trim()}\n\nSkill source files:\n\n${skillReference}`;
  } finally {
    if (!process.env.KEEP_TEST_OUTPUT) {
      await rm(npmCache, { recursive: true, force: true });
    }
  }
}

async function readSkillReference() {
  const files = [
    'SKILL.md',
    'references/agents-rules.md',
    'references/agents-rubric.md',
    'references/doc-audit.md',
    'references/readme-rules.md',
    'references/documentation-architecture.md',
    'references/readme-rubric.md',
    'references/validation.md',
    'references/writing-style.md',
    'docs/context-placement.md',
    'assets/templates/AGENTS.project.md',
    'assets/templates/AGENTS.overlay.md',
  ];

  const chunks = [];

  for (const file of files) {
    chunks.push(`--- @agent-doc-rules/skill/${file} ---\n${await readFile(join(skillSource, file), 'utf8')}`);
  }

  return chunks.join('\n\n');
}

async function readProjectFiles(projectDir) {
  const files = await collectFiles(projectDir);
  const chunks = [];

  for (const file of files) {
    const rel = relative(projectDir, file);

    if (rel.startsWith('.agents/skills/agent-doc-rules/') || rel === 'skills-lock.json') {
      continue;
    }

    chunks.push(`--- ${rel} ---\n${await readProjectFileForPrompt(file, rel)}`);
  }

  return chunks.join('\n\n');
}

async function readProjectFileForPrompt(file, rel) {
  const content = await readFile(file, 'utf8');

  if (rel !== 'package.json') {
    return content;
  }

  const packageJson = JSON.parse(content);

  if (packageJson.scripts) {
    delete packageJson.scripts['test:agent'];

    if (Object.keys(packageJson.scripts).length === 0) {
      delete packageJson.scripts;
    }
  }

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function collectFiles(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    if (['node_modules', '.git'].includes(entry)) {
      continue;
    }

    const path = join(dir, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      files.push(...await collectFiles(path));
      continue;
    }

    if (path.endsWith('.md') || path.endsWith('VERSION') || entry === 'package.json') {
      files.push(path);
    }
  }

  return files.sort();
}

async function assertFile(path) {
  const info = await stat(path).catch(() => undefined);

  if (!info?.isFile()) {
    throw new Error(`Expected file was not created: ${path}`);
  }
}

function normalizeGeneratedFiles(files) {
  if (!Array.isArray(files)) {
    throw new Error('Generator did not return a files array.');
  }

  const seen = new Set();

  return files.map((file) => {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Generator returned an invalid file entry.');
    }

    const normalizedPath = file.path.replaceAll('\\', '/').replace(/^\.\/+/, '');

    if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.includes('../')) {
      throw new Error(`Generator returned unsafe file path: ${file.path}`);
    }

    if (normalizedPath.startsWith('.agents/skills/agent-doc-rules/')) {
      throw new Error(`Generator must not modify installed skill files: ${normalizedPath}`);
    }

    if (seen.has(normalizedPath)) {
      throw new Error(`Generator returned duplicate file path: ${normalizedPath}`);
    }

    seen.add(normalizedPath);

    return {
      path: normalizedPath,
      content: `${file.content.trim()}\n`,
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

async function writeGeneratedFiles(projectDir, files) {
  for (const file of files) {
    const target = join(projectDir, file.path);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

function formatGeneratedFiles(files) {
  return files.map((file) => {
    return `--- ${file.path} ---\n${file.content}`;
  }).join('\n\n');
}

function render(template, values) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
