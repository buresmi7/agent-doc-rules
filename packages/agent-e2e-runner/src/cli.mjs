import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildAgentRuntimeFromEnv,
  readAgentMetadata,
  validateAgentRuntime,
} from './agent-runtime.mjs';
import { runAgentScenario, readSnapshotDirName } from './agent-scenario.mjs';
import { runCommandScenario } from './command-runtime.mjs';
import { defaultJudgePromptTemplate } from './defaults.mjs';

const defaultConfigFiles = [
  'agent-e2e.config.mjs',
  'agent-e2e.config.js',
];
const commandOptions = {
  agent: new Set([
    'config',
    'help',
    'keep_output',
    'name',
    'project',
    'repo_root',
    'scenario',
    'skill',
    'skill_package',
    'snapshot_dir',
    'update_snapshots',
  ]),
  command: new Set([
    'help',
    'keep_output',
    'name',
    'project',
    'repo_root',
    'scenario',
  ]),
};

export async function main(argv = process.argv.slice(2), {
  cwd = process.cwd(),
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const { command, options } = parseCliArgs(argv);

  if (options.help || !command) {
    stdout.write(`${usage()}\n`);
    return 0;
  }

  if (command === 'agent') {
    return runAgentCommand({ options, cwd, env, stdout, stderr });
  }

  if (command === 'command') {
    return runCommandCommand({ options, cwd, env, stdout, stderr });
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

export function parseCliArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    return {
      command: null,
      options: { help: true },
    };
  }

  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replaceAll('-', '_');
    const allowedOptions = commandOptions[command];

    if (allowedOptions && !allowedOptions.has(key)) {
      throw new Error(`Unknown option for ${command}: --${rawKey}`);
    }

    if (['help', 'update_snapshots', 'keep_output'].includes(key)) {
      if (inlineValue !== undefined && !['true', 'false'].includes(inlineValue)) {
        throw new Error(`--${rawKey} must be true or false.`);
      }

      options[key] = inlineValue === undefined || inlineValue === 'true';
      continue;
    }

    const value = inlineValue ?? rest[index + 1];

    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${rawKey}`);
    }

    options[key] = value;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return { command, options };
}

export async function runAgentCommand({ options, cwd, env, stdout, stderr }) {
  const scenarioDir = resolveRequiredPath(cwd, options.scenario, '--scenario');
  const projectFixtureDir = options.project
    ? resolve(cwd, options.project)
    : join(scenarioDir, 'project');
  const repoRoot = options.repo_root ? resolve(cwd, options.repo_root) : cwd;
  const scenarioName = options.name ?? basename(scenarioDir);
  const { config, configPath, configDir } = await readConfig({ cwd, explicitPath: options.config });
  const skillsCliVersion = readSkillsCliVersion(config);
  const skill = {
    packageName: readRequiredOption(options.skill_package, '--skill-package'),
    name: readRequiredOption(options.skill, '--skill'),
  };
  const runtime = await buildAgentRuntimeFromEnv(env);
  const keepOutput = options.keep_output ?? env.KEEP_TEST_OUTPUT === '1';
  const updateSnapshots = options.update_snapshots ?? env.UPDATE_AGENT_SNAPSHOTS === '1';
  const snapshotDirName = options.snapshot_dir ?? readSnapshotDirName(env);
  const judgePromptTemplate = await readJudgePrompt({
    config,
    configDir,
  });

  try {
    await validateAgentRuntime(runtime);

    const agentMetadata = await readAgentMetadata(runtime);
    const result = await runAgentScenario({
      scenarioName,
      scenarioDir,
      projectFixtureDir,
      repoRoot,
      runtime: {
        ...runtime,
        keepOutput,
      },
      skill,
      skillsCliVersion,
      judgePromptTemplate,
      agentMetadata,
      snapshotDirName,
      updateSnapshots,
      keepOutput,
      passThreshold: config.passThreshold ?? 0.8,
      tempPrefix: config.tempPrefix ?? 'agent-e2e',
      inspectLinks: config.inspectLinks ?? {},
      projectFileOptions: config.projectFileOptions ?? {},
      env,
      onProgress: (event) => printAgentProgress(stdout, scenarioName, event),
    });

    if (!result.pass) {
      printAgentFailure(stderr, result);
      return 1;
    }

    stdout.write(`Agent E2E test passed for ${scenarioName}.\n`);

    if (result.outputDir) {
      stdout.write(`output: ${result.outputDir}\n`);
    }

    return 0;
  } catch (error) {
    stderr.write(`Agent E2E test failed for ${scenarioName}.\n`);
    stderr.write(`${error.stack ?? error.message}\n`);

    if (configPath) {
      stderr.write(`config: ${configPath}\n`);
    }

    return 1;
  }
}

export async function runCommandCommand({ options, cwd, env, stdout, stderr }) {
  const scenarioDir = resolveRequiredPath(cwd, options.scenario, '--scenario');
  const projectFixtureDir = options.project
    ? resolve(cwd, options.project)
    : join(scenarioDir, 'project');
  const repoRoot = options.repo_root ? resolve(cwd, options.repo_root) : cwd;
  const scenarioName = options.name ?? basename(scenarioDir);
  const tempDir = await mkdtemp(join(tmpdir(), `agent-e2e-command-${scenarioName}-`));
  const projectDir = join(tempDir, 'project');
  const keepOutput = options.keep_output ?? env.KEEP_TEST_OUTPUT === '1';

  try {
    await cp(projectFixtureDir, projectDir, { recursive: true });

    const scenario = JSON.parse(await readFile(join(scenarioDir, 'scenario.json'), 'utf8'));
    const result = await runCommandScenario({
      scenario,
      scenarioDir,
      projectDir,
      repoRoot,
      env,
    });

    if (!result.pass) {
      printCommandFailure(stderr, scenarioName, result, tempDir);
      return 1;
    }

    stdout.write(`Command E2E test passed for ${scenarioName}.\n`);

    if (keepOutput) {
      stdout.write(`output: ${tempDir}\n`);
    } else {
      await rm(tempDir, { recursive: true, force: true });
    }

    return 0;
  } catch (error) {
    stderr.write(`Command E2E test failed for ${scenarioName}.\n`);
    stderr.write(`${error.stack ?? error.message}\n`);
    stderr.write(`output: ${tempDir}\n`);
    return 1;
  }
}

export async function readConfig({ cwd, explicitPath }) {
  const configPath = explicitPath
    ? resolve(cwd, explicitPath)
    : await findDefaultConfig(cwd);

  if (!configPath) {
    return {
      config: {},
      configPath: null,
      configDir: cwd,
    };
  }

  const imported = await import(pathToFileURL(configPath).href);

  return {
    config: imported.default ?? imported.config ?? {},
    configPath,
    configDir: dirname(configPath),
  };
}

async function findDefaultConfig(cwd) {
  for (const file of defaultConfigFiles) {
    const path = join(cwd, file);

    try {
      await readFile(path, 'utf8');
      return path;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return null;
}

function readSkillsCliVersion(config) {
  if (config.skill !== undefined) {
    throw new Error(
      'agent-e2e.config.mjs does not accept skill. Pass --skill-package and --skill, and declare the package in project/package.json.',
    );
  }

  const value = config.skillsCliVersion ?? '1.5.12';

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('skillsCliVersion must be a non-empty string.');
  }

  return value;
}

async function readJudgePrompt({ config, configDir }) {
  if (!config.judgePrompt) {
    return defaultJudgePromptTemplate;
  }

  return readFile(resolvePath(configDir, config.judgePrompt), 'utf8');
}

function printAgentFailure(stderr, result) {
  stderr.write('Agent E2E tests failed:\n');
  stderr.write(`\n## ${result.scenario}\n`);
  stderr.write(`score: ${result.score ?? 'n/a'}\n`);
  stderr.write(`${result.notes}\n`);

  for (const criterion of result.failedCriteria ?? []) {
    stderr.write(`- ${criterion.id}: ${criterion.reason}\n`);
  }

  for (const fix of result.requiredFixes ?? []) {
    stderr.write(`fix: ${fix}\n`);
  }

  if (result.changedFilePaths?.length > 0) {
    stderr.write(`changed: ${result.changedFilePaths.join(', ')}\n`);
  }

  if (result.transcript) {
    stderr.write(`transcript:\n${result.transcript}\n`);
  }

  if (result.outputDir) {
    stderr.write(`output: ${result.outputDir}\n`);
  }

  if (result.failureReportPath) {
    stderr.write(`report: ${result.failureReportPath}\n`);
  }

  if (result.agentSessionPath) {
    stderr.write(`session: ${result.agentSessionPath}\n`);
  }

  if (result.failureSummaryPath) {
    stderr.write(`summary: ${result.failureSummaryPath}\n`);
  }

  for (const warning of result.artifactWriteErrors ?? []) {
    stderr.write(`artifact warning: ${warning}\n`);
  }
}

function printAgentProgress(stdout, scenarioName, event) {
  if (event.type === 'turn:start') {
    stdout.write(
      `Agent E2E ${scenarioName}: turn ${event.index}/${event.total} (${event.source})\n`,
    );
    return;
  }

  if (event.type === 'judge:start') {
    stdout.write(`Agent E2E ${scenarioName}: judging\n`);
  }
}

function printCommandFailure(stderr, scenarioName, result, outputDir) {
  stderr.write(`Command E2E test failed for ${scenarioName}.\n`);
  stderr.write(`command: ${result.command}\n`);
  stderr.write(`exit: ${result.result.code}\n`);

  for (const failure of result.failures) {
    stderr.write(`- ${failure}\n`);
  }

  stderr.write(`output: ${outputDir}\n`);

  if (result.result.stdout.trim()) {
    stderr.write('\nstdout:\n');
    stderr.write(`${result.result.stdout.trimEnd()}\n`);
  }

  if (result.result.stderr.trim()) {
    stderr.write('\nstderr:\n');
    stderr.write(`${result.result.stderr.trimEnd()}\n`);
  }
}

function resolveRequiredPath(cwd, value, flag) {
  if (!value) {
    throw new Error(`${flag} is required.`);
  }

  return resolve(cwd, value);
}

function readRequiredOption(value, flag) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${flag} is required.`);
  }

  return value;
}

function resolvePath(baseDir, value) {
  if (value.startsWith('file:')) {
    return new URL(value).pathname;
  }

  return isAbsolute(value) ? value : resolve(baseDir, value);
}

function usage() {
  return `Usage:
  agent-e2e-runner agent --scenario e2e/<name> --skill-package <package> --skill <name> [--config agent-e2e.config.mjs]
  agent-e2e-runner command --scenario e2e/<name>

Shared options:
  --scenario <dir>       Scenario directory containing project/ and scenario.json.
  --project <dir>        Fixture project directory. Defaults to <scenario>/project.
  --repo-root <dir>      Repository root. Defaults to the current directory.
  --keep-output          Keep temporary output directories.
  --name <name>          Scenario name override.
  --help                 Print this usage.

Agent options:
  --config <file>        Runner config. Defaults to agent-e2e.config.mjs when present.
  --skill-package <pkg>  Fixture dependency that contains the tested skill.
  --skill <name>         Skill name passed to the skills installer.
  --snapshot-dir <name>  Snapshot directory name.
  --update-snapshots     Refresh passing snapshots.
`;
}
