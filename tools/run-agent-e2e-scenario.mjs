import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentGenerate,
  readAgentMetadata,
  readCodexConfig,
  validateAgentRuntime,
} from './e2e-runner/agent-runtime.mjs';
import {
  formatGeneratedFiles,
  normalizeGeneratedFiles,
  readProjectFiles,
  writeGeneratedFiles,
} from './e2e-runner/project-files.mjs';
import {
  buildGeneratePrompt,
  generateSchema,
  judgeSchema,
  render,
} from './e2e-runner/prompts.mjs';
import {
  installSkill,
  readSkillReference,
  readSkillUsePrompt,
} from './e2e-runner/skill.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const e2eRoot = join(repoRoot, 'e2e');
const projectFixtureDir = process.env.SCENARIO_DIR
  ? resolve(process.env.SCENARIO_DIR)
  : process.cwd();
const scenarioDir = dirname(projectFixtureDir);
const scenarioName = process.env.SCENARIO_NAME ?? basename(scenarioDir);
const snapshotDirName = readSnapshotDirName();
const scenarioRequire = createRequire(join(projectFixtureDir, 'package.json'));
const skillPackageJson = scenarioRequire.resolve('@buresmi7/agent-doc-rules-skill/package.json');
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
const keepOutput = Boolean(process.env.KEEP_TEST_OUTPUT);
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
const runtime = {
  runner,
  codexBin,
  ollamaHost,
  generatorModel,
  judgeModel,
  codexModel,
  codexReasoningEffort,
  codexModelSource,
  codexReasoningEffortSource,
  codexConfigHome: codexConfig.home,
  keepOutput,
};

try {
  await validateAgentRuntime(runtime);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const skillReference = await readSkillReference(skillSource);
const ollamaSkillContext = runner === 'ollama'
  ? await readSkillUsePrompt({
    scenarioDir,
    skillSource,
    skillName,
    skillsCliVersion,
    skillReference,
    keepOutput,
  })
  : '';
const judgePromptTemplate = await readFile(join(e2eRoot, 'prompts/judge-agents.md'), 'utf8');
const agentMetadata = await readAgentMetadata(runtime);

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

  if (result.generatedFilePaths?.length > 0) {
    console.error(`generated: ${result.generatedFilePaths.join(', ')}`);
  }

  if (result.generatorNotes) {
    console.error(`generator notes: ${result.generatorNotes}`);
  }

  if (result.outputDir) {
    console.error(`output: ${result.outputDir}`);
  }

  if (result.failureSummaryPath) {
    console.error(`summary: ${result.failureSummaryPath}`);
  }

  process.exit(1);
}

console.log(`Agent E2E test passed for ${scenarioName}.`);

async function runScenario() {
  const tempDir = await mkdtemp(join(tmpdir(), `agent-doc-rules-${scenarioName}-`));
  const projectDir = join(tempDir, 'project');

  await cp(projectFixtureDir, projectDir, { recursive: true });
  await installSkill({
    projectDir,
    skillSource,
    skillName,
    skillsCliVersion,
    keepOutput,
  });

  const scenarioPrompt = await readFile(join(scenarioDir, 'prompt.md'), 'utf8');
  const projectFilesBefore = await readProjectFiles(projectDir);
  const prompt = buildGeneratePrompt({
    scenarioPrompt,
    projectFiles: projectFilesBefore,
    skillContext: ollamaSkillContext,
  });
  const generated = await agentGenerate(runtime, {
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
    generatorNotes: generated.notes,
  });
  const judgment = await agentGenerate(runtime, {
    role: `${scenarioName}-judge`,
    prompt: judgePrompt,
    schema: judgeSchema,
    cwd: projectDir,
  });
  const pass = Boolean(judgment.pass) && Number(judgment.score) >= 0.8;
  const failureSummaryPath = join(tempDir, 'failure-summary.json');

  if (pass && updateAgentSnapshots) {
    await writeScenarioSnapshot({ generatedFiles, generated, judgment });
  }

  if (!pass) {
    await writeFailureSummary({
      tempDir,
      projectDir,
      generatedFiles,
      generated,
      judgment,
    });
  }

  if (pass && !keepOutput) {
    await rm(tempDir, { recursive: true, force: true });
  }

  return {
    scenario: scenarioName,
    ...judgment,
    pass,
    generatedFilePaths: generatedFiles.map((file) => file.path),
    generatorNotes: generated.notes,
    outputDir: pass ? undefined : tempDir,
    failureSummaryPath: pass ? undefined : failureSummaryPath,
  };
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
        name: '@buresmi7/agent-doc-rules-skill',
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

async function writeFailureSummary({ tempDir, projectDir, generatedFiles, generated, judgment }) {
  const summary = {
    scenario: scenarioName,
    runner,
    pass: false,
    score: judgment.score ?? null,
    failedCriteria: judgment.failedCriteria ?? [],
    requiredFixes: judgment.requiredFixes ?? [],
    generatorNotes: generated.notes ?? '',
    judgeNotes: judgment.notes ?? '',
    generatedFiles: generatedFiles.map((file) => ({
      path: file.path,
      projectPath: join('project', file.path).replaceAll('\\', '/'),
      lineCount: file.content.trimEnd() ? file.content.trimEnd().split('\n').length : 0,
    })),
    inspect: {
      outputDir: tempDir,
      projectDir: relative(tempDir, projectDir),
      triageDoc: 'docs/e2e-failure-triage.md',
      ruleMatrix: 'docs/e2e-rule-matrix.md',
      rulePlacement: 'docs/rule-placement.md',
      criteria: relative(repoRoot, join(scenarioDir, 'criteria.md')),
      prompt: relative(repoRoot, join(scenarioDir, 'prompt.md')),
    },
  };

  await writeFile(join(tempDir, 'failure-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

function readSnapshotDirName() {
  const value = process.env.AGENT_E2E_SNAPSHOT_DIR ?? 'snapshot';

  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`AGENT_E2E_SNAPSHOT_DIR must be a directory name, got ${JSON.stringify(value)}`);
  }

  return value;
}
