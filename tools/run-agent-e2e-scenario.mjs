import { mkdtemp, rm, cp, mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const e2eRoot = join(repoRoot, 'e2e');
const projectFixtureDir = process.env.SCENARIO_DIR
  ? resolve(process.env.SCENARIO_DIR)
  : process.cwd();
const scenarioDir = dirname(projectFixtureDir);
const scenarioName = process.env.SCENARIO_NAME ?? basename(scenarioDir);
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
const codexModel = process.env.CODEX_MODEL;
const ollamaHost = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const generatorModel = process.env.OLLAMA_GENERATOR_MODEL ?? process.env.OLLAMA_MODEL;
const judgeModel = process.env.OLLAMA_JUDGE_MODEL ?? process.env.OLLAMA_MODEL;
const updateAgentSnapshots = process.env.UPDATE_AGENT_SNAPSHOTS === '1';

const generateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    agentsMd: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['agentsMd', 'notes'],
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
  const agentsMd = normalizeAgentsMd(generated.agentsMd);
  await writeFile(join(projectDir, 'AGENTS.md'), agentsMd);

  const criteria = await readFile(join(scenarioDir, 'criteria.md'), 'utf8');
  const projectFilesAfter = await readProjectFiles(projectDir);
  const judgePrompt = render(judgePromptTemplate, {
    criteria,
    skillReference,
    originalProjectFiles: projectFilesBefore,
    projectFiles: projectFilesAfter,
    agentsMd,
  });

  const judgment = await agentGenerate({
    role: `${scenarioName}-judge`,
    prompt: judgePrompt,
    schema: judgeSchema,
    cwd: projectDir,
  });
  const pass = Boolean(judgment.pass) && Number(judgment.score) >= 0.8;

  if (pass && updateAgentSnapshots) {
    await writeScenarioSnapshot({ agentsMd, generated, judgment });
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
  "agentsMd": "complete root AGENTS.md content",
  "notes": "short implementation note"
}
\`\`\`

Rules:

- Create or repair only the root \`AGENTS.md\` content.
- Keep \`AGENTS.md\` concise. It is an always-loaded navigation layer.
- Wrap Markdown prose and bullets so lines stay under 100 characters.
- Link or point to installed shared rules instead of copying their full text.
- The target project has installed \`agent-doc-rules\` at
  \`.agents/skills/agent-doc-rules/\`; use reference paths under that directory.
- Include these installed shared rule references when creating a Shared Rules
  section: \`.agents/skills/agent-doc-rules/references/agents-md.md\`,
  \`.agents/skills/agent-doc-rules/references/readme.md\`, and
  \`.agents/skills/agent-doc-rules/references/documentation-architecture.md\`.
- Preserve project-specific facts from the project README and any existing \`AGENTS.md\`.
- Do not invent build commands, services, tools, owners, cloud accounts, issue systems, or technologies.
- Do not recommend optional skills, Notion, task-manager workflows, worktrees, or external tools.
- Include local overrides only when the project context supports them.
- Include source-of-truth and verification guidance when the project context supports them.
${optionalSkillContext}
Project files:

\`\`\`text
${projectFiles}
\`\`\`
`;
}

async function writeScenarioSnapshot({ agentsMd, generated, judgment }) {
  const snapshotDir = join(scenarioDir, 'snapshot');
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(join(snapshotDir, 'AGENTS.md'), agentsMd);
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
    'references/agents-md.md',
    'references/readme.md',
    'references/documentation-architecture.md',
    'references/readme-rubric.md',
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

    if (rel.startsWith('.agents/skills/') || rel === 'skills-lock.json') {
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

function normalizeAgentsMd(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Generator did not return non-empty agentsMd.');
  }

  return `${value.trim()}\n`;
}

function render(template, values) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
