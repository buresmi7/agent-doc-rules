import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommandScenario } from './e2e-runner/command-runtime.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectFixtureDir = process.env.SCENARIO_DIR
  ? resolve(process.env.SCENARIO_DIR)
  : process.cwd();
const scenarioDir = dirname(projectFixtureDir);
const scenarioName = process.env.SCENARIO_NAME ?? basename(scenarioDir);
const keepOutput = Boolean(process.env.KEEP_TEST_OUTPUT);

const result = await runScenario().catch((error) => ({
  pass: false,
  command: 'command E2E harness',
  result: {
    code: 1,
    stdout: '',
    stderr: error.stack ?? error.message,
  },
  failures: [error.message],
}));

if (!result.pass) {
  console.error(`Command E2E test failed for ${scenarioName}.`);
  console.error(`command: ${result.command}`);
  console.error(`exit: ${result.result.code}`);

  for (const failure of result.failures) {
    console.error(`- ${failure}`);
  }

  if (result.outputDir) {
    console.error(`output: ${result.outputDir}`);
  }

  if (result.result.stdout.trim()) {
    console.error('\nstdout:');
    console.error(result.result.stdout.trimEnd());
  }

  if (result.result.stderr.trim()) {
    console.error('\nstderr:');
    console.error(result.result.stderr.trimEnd());
  }

  process.exit(1);
}

console.log(`Command E2E test passed for ${scenarioName}.`);

async function runScenario() {
  const tempDir = await mkdtemp(join(tmpdir(), `agent-doc-rules-command-${scenarioName}-`));
  const projectDir = join(tempDir, 'project');

  await cp(projectFixtureDir, projectDir, { recursive: true });

  const scenario = JSON.parse(await readFile(join(scenarioDir, 'scenario.json'), 'utf8'));
  const result = await runCommandScenario({
    scenario,
    projectDir,
    repoRoot,
  });

  if (result.pass && !keepOutput) {
    await rm(tempDir, { recursive: true, force: true });
  }

  return {
    ...result,
    outputDir: result.pass ? undefined : tempDir,
  };
}
