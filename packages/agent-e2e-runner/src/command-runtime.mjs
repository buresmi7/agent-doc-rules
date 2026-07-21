import { access, readFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { runCommandCapture } from './process.mjs';

export async function runCommandScenario({
  scenario,
  projectDir,
  repoRoot,
  scenarioDir = projectDir,
  env = process.env,
}) {
  validateScenario(scenario);

  const result = await runCommandCapture(
    scenario.command,
    scenario.args ?? [],
    scenario.stdin ?? '',
    {
      cwd: projectDir,
      env: buildCommandScenarioEnv({ env, repoRoot }),
    },
  );
  const failures = await evaluateCommandExpectations({
    result,
    expect: scenario.expect ?? {},
    projectDir,
    scenarioDir,
  });

  return {
    pass: failures.length === 0,
    command: [scenario.command, ...(scenario.args ?? [])].join(' '),
    result,
    failures,
  };
}

export function buildCommandScenarioEnv({ env, repoRoot }) {
  return {
    ...env,
    NO_COLOR: env.NO_COLOR ?? '1',
    PATH: [join(repoRoot, 'node_modules/.bin'), env.PATH].filter(Boolean).join(delimiter),
  };
}

export async function evaluateCommandExpectations({
  result,
  expect,
  projectDir,
  scenarioDir = projectDir,
}) {
  const failures = [];
  const expectedExitCode = expect.exitCode ?? 0;

  if (result.code !== expectedExitCode) {
    failures.push(`Expected exit ${expectedExitCode}, got ${result.code}.`);
  }

  collectIncludes(failures, 'stdout', result.stdout, expect.stdoutIncludes ?? []);
  collectIncludes(failures, 'stderr', result.stderr, expect.stderrIncludes ?? []);
  collectExcludes(failures, 'stdout', result.stdout, expect.stdoutExcludes ?? []);
  collectExcludes(failures, 'stderr', result.stderr, expect.stderrExcludes ?? []);
  await collectSnapshotMatch({
    failures,
    streamName: 'stdout',
    actual: result.stdout,
    snapshotPath: expect.stdoutSnapshot,
    scenarioDir,
  });
  await collectSnapshotMatch({
    failures,
    streamName: 'stderr',
    actual: result.stderr,
    snapshotPath: expect.stderrSnapshot,
    scenarioDir,
  });

  for (const file of expect.filesExist ?? []) {
    try {
      await access(join(projectDir, file));
    } catch (error) {
      if (error.code === 'ENOENT') {
        failures.push(`Expected ${file} to exist.`);
      } else {
        throw error;
      }
    }
  }

  for (const file of expect.filesDoNotExist ?? []) {
    try {
      await access(join(projectDir, file));
      failures.push(`Expected ${file} not to exist.`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return failures;
}

function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
    throw new Error('Command E2E scenario must be a JSON object.');
  }

  if (!scenario.command || typeof scenario.command !== 'string') {
    throw new Error('Command E2E scenario requires a string command.');
  }

  if (scenario.args && !Array.isArray(scenario.args)) {
    throw new Error('Command E2E scenario args must be an array.');
  }
}

function collectIncludes(failures, streamName, value, expectedValues) {
  for (const expected of expectedValues) {
    if (!value.includes(expected)) {
      failures.push(`Expected ${streamName} to include ${JSON.stringify(expected)}.`);
    }
  }
}

function collectExcludes(failures, streamName, value, expectedValues) {
  for (const expected of expectedValues) {
    if (value.includes(expected)) {
      failures.push(`Expected ${streamName} not to include ${JSON.stringify(expected)}.`);
    }
  }
}

async function collectSnapshotMatch({
  failures,
  streamName,
  actual,
  snapshotPath,
  scenarioDir,
}) {
  if (!snapshotPath) {
    return;
  }

  const expected = await readFile(join(scenarioDir, snapshotPath), 'utf8')
    .catch((error) => {
      if (error.code === 'ENOENT') {
        failures.push(`Expected ${streamName} snapshot ${snapshotPath} to exist.`);
        return null;
      }

      throw error;
    });

  if (expected === null) {
    return;
  }

  if (actual !== expected) {
    failures.push(`Expected ${streamName} to match ${snapshotPath}.`);
  }
}
