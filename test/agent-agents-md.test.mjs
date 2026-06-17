import { mkdtemp, rm, cp, mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const ollamaHost = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
const generatorModel = process.env.OLLAMA_GENERATOR_MODEL ?? process.env.OLLAMA_MODEL;
const judgeModel = process.env.OLLAMA_JUDGE_MODEL ?? process.env.OLLAMA_MODEL;

const scenarios = [
  { name: 'create-basic', mode: 'create' },
  { name: 'repair-bloated', mode: 'repair' },
];

const generateSchema = {
  type: 'object',
  properties: {
    agentsMd: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['agentsMd', 'notes'],
};

const judgeSchema = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    failedCriteria: {
      type: 'array',
      items: {
        type: 'object',
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

if (!generatorModel || !judgeModel) {
  console.error('Agent E2E test requires OLLAMA_MODEL or both OLLAMA_GENERATOR_MODEL and OLLAMA_JUDGE_MODEL.');
  console.error('Example: OLLAMA_MODEL=llama3.1 npm test');
  process.exit(1);
}

await assertOllamaAvailable();

const sharedRules = await readSharedRules();
const generatePromptTemplate = await readFile(join(root, 'test/prompts/generate-agents.md'), 'utf8');
const judgePromptTemplate = await readFile(join(root, 'test/prompts/judge-agents.md'), 'utf8');

const failures = [];

for (const scenario of scenarios) {
  const result = await runScenario(scenario).catch((error) => ({
    scenario: scenario.name,
    pass: false,
    notes: error.stack ?? error.message,
    failedCriteria: [{ id: 'HARNESS', reason: error.message }],
    requiredFixes: ['Fix the test harness or model setup.'],
  }));

  if (!result.pass) {
    failures.push(result);
  }
}

if (failures.length > 0) {
  console.error('Agent E2E tests failed:');

  for (const failure of failures) {
    console.error(`\n## ${failure.scenario}`);
    console.error(`score: ${failure.score ?? 'n/a'}`);
    console.error(failure.notes);

    for (const criterion of failure.failedCriteria ?? []) {
      console.error(`- ${criterion.id}: ${criterion.reason}`);
    }

    for (const fix of failure.requiredFixes ?? []) {
      console.error(`fix: ${fix}`);
    }

    if (failure.outputDir) {
      console.error(`output: ${failure.outputDir}`);
    }
  }

  process.exit(1);
}

console.log(`Agent E2E tests passed for ${scenarios.length} scenarios.`);

async function runScenario(scenario) {
  const fixtureDir = join(root, 'test/fixtures', scenario.name);
  const tempDir = await mkdtemp(join(tmpdir(), `agent-doc-rules-${scenario.name}-`));
  const projectDir = join(tempDir, 'project');

  await cp(join(fixtureDir, 'project'), projectDir, { recursive: true });
  await vendorSharedRules(projectDir);

  const projectFilesBefore = await readProjectFiles(projectDir);
  const prompt = render(generatePromptTemplate, {
    mode: scenario.mode,
    sharedRules,
    projectFiles: projectFilesBefore,
  });

  const generated = await ollamaGenerate(generatorModel, prompt, generateSchema);
  const agentsMd = normalizeAgentsMd(generated.agentsMd);
  await writeFile(join(projectDir, 'AGENTS.md'), agentsMd);

  const criteria = await readFile(join(fixtureDir, 'criteria.md'), 'utf8');
  const projectFilesAfter = await readProjectFiles(projectDir);
  const judgePrompt = render(judgePromptTemplate, {
    criteria,
    sharedRules,
    projectFiles: projectFilesAfter,
    agentsMd,
  });

  const judgment = await ollamaGenerate(judgeModel, judgePrompt, judgeSchema);
  const pass = Boolean(judgment.pass) && Number(judgment.score) >= 0.8;

  if (pass && !process.env.KEEP_TEST_OUTPUT) {
    await rm(tempDir, { recursive: true, force: true });
  }

  return {
    scenario: scenario.name,
    ...judgment,
    pass,
    outputDir: pass ? undefined : tempDir,
  };
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

async function vendorSharedRules(projectDir) {
  const target = join(projectDir, 'agent-rules/shared');
  await mkdir(target, { recursive: true });
  await cp(join(root, 'rules'), join(target, 'rules'), { recursive: true });
  await cp(join(root, 'templates'), join(target, 'templates'), { recursive: true });
  await writeFile(join(target, 'VERSION'), `agent-doc-rules ${currentVersion()}\n`);
}

function currentVersion() {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  return `v${packageJson.version}`;
}

async function readSharedRules() {
  const files = [
    'rules/agents-md.md',
    'rules/documentation-architecture.md',
    'templates/AGENTS.project.md',
    'templates/AGENTS.overlay.md',
  ];

  const chunks = [];

  for (const file of files) {
    chunks.push(`--- ${file} ---\n${await readFile(join(root, file), 'utf8')}`);
  }

  return chunks.join('\n\n');
}

async function readProjectFiles(projectDir) {
  const files = await collectFiles(projectDir);
  const chunks = [];

  for (const file of files) {
    const rel = relative(projectDir, file);

    if (rel.startsWith('agent-rules/shared/')) {
      continue;
    }

    chunks.push(`--- ${rel} ---\n${await readFile(file, 'utf8')}`);
  }

  return chunks.join('\n\n');
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

    if (path.endsWith('.md') || path.endsWith('VERSION')) {
      files.push(path);
    }
  }

  return files.sort();
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
