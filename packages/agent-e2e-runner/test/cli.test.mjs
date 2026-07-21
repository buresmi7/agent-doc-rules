import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  main,
  parseCliArgs,
  readConfig,
} from '../src/cli.mjs';

test('parseCliArgs reads commands, values, and boolean flags', () => {
  assert.deepEqual(parseCliArgs([
    'agent',
    '--scenario',
    'e2e/example',
    '--skill-package',
    '@example/todo-skill',
    '--skill=todo-cleaner',
    '--config=agent-e2e.config.mjs',
    '--update-snapshots',
  ]), {
    command: 'agent',
    options: {
      scenario: 'e2e/example',
      skill_package: '@example/todo-skill',
      skill: 'todo-cleaner',
      config: 'agent-e2e.config.mjs',
      update_snapshots: true,
    },
  });
});

test('parseCliArgs supports top-level help', () => {
  assert.deepEqual(parseCliArgs(['--help']), {
    command: null,
    options: { help: true },
  });
});

test('parseCliArgs rejects unknown command options', () => {
  assert.throws(
    () => parseCliArgs(['agent', '--scenario', 'e2e/example', '--udpate-snapshots']),
    /Unknown option for agent: --udpate-snapshots/,
  );
});

test('parseCliArgs rejects ambiguous boolean values', () => {
  assert.throws(
    () => parseCliArgs(['agent', '--scenario', 'e2e/example', '--keep-output=1']),
    /--keep-output must be true or false/,
  );
});

test('readConfig loads default agent-e2e config from cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-config-'));

  await writeFile(join(root, 'agent-e2e.config.mjs'), `export default {
    skillsCliVersion: '1.5.12',
    passThreshold: 0.9
  };
`);

  const result = await readConfig({ cwd: root });

  assert.equal(result.config.skillsCliVersion, '1.5.12');
  assert.equal(result.config.passThreshold, 0.9);
  assert.equal(result.configPath, join(root, 'agent-e2e.config.mjs'));
  assert.equal(result.configDir, root);
});

test('agent command rejects skill configuration in the shared config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-legacy-config-'));

  await writeFile(join(root, 'agent-e2e.config.mjs'), `export default {
    skill: {
      name: 'example-skill',
      source: './skill'
    }
  };
`);

  await assert.rejects(
    () => main(['agent', '--scenario', 'e2e/example'], { cwd: root }),
    /Pass --skill-package and --skill, and declare the package in project\/package\.json/,
  );
});

test('agent command requires an explicit package and skill selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-skill-options-'));

  await assert.rejects(
    () => main([
      'agent',
      '--scenario',
      'e2e/example',
      '--skill-package',
      '@example/todo-skill',
    ], { cwd: root }),
    /--skill is required/,
  );
});

test('main runs a command scenario from the standalone CLI surface', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-command-cli-'));
  const scenarioDir = join(root, 'e2e/example');
  const projectDir = join(scenarioDir, 'project');
  const stdout = captureStream();
  const stderr = captureStream();

  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'package.json'), '{"type":"module"}\n');
  await writeFile(join(scenarioDir, 'scenario.json'), JSON.stringify({
    command: process.execPath,
    args: ['-e', 'console.log("ok")'],
    expect: {
      stdoutIncludes: ['ok'],
    },
  }, null, 2));

  const code = await main([
    'command',
    '--scenario',
    'e2e/example',
    '--repo-root',
    root,
  ], {
    cwd: root,
    env: { PATH: process.env.PATH, KEEP_TEST_OUTPUT: '0' },
    stdout,
    stderr,
  });

  assert.equal(code, 0);
  assert.match(stdout.value, /Command E2E test passed for example/);
  assert.doesNotMatch(stdout.value, /output:/);
  assert.equal(stderr.value, '');
});

test('main reports retained command output when KEEP_TEST_OUTPUT is enabled', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-command-cli-keep-'));
  const scenarioDir = join(root, 'e2e/example');
  const projectDir = join(scenarioDir, 'project');
  const stdout = captureStream();
  const stderr = captureStream();

  await mkdir(projectDir, { recursive: true });
  await writeFile(join(scenarioDir, 'scenario.json'), JSON.stringify({
    command: process.execPath,
    args: ['-e', 'console.log("ok")'],
  }, null, 2));

  const code = await main([
    'command',
    '--scenario',
    'e2e/example',
    '--repo-root',
    root,
  ], {
    cwd: root,
    env: { PATH: process.env.PATH, KEEP_TEST_OUTPUT: '1' },
    stdout,
    stderr,
  });
  const outputDir = stdout.value.match(/output: (.+)\n/)?.[1];

  assert.equal(code, 0);
  assert.ok(outputDir);
  await access(join(outputDir, 'project'));
  assert.equal(stderr.value, '');

  await rm(outputDir, { recursive: true, force: true });
});

test('main reports command scenario failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-command-cli-fail-'));
  const scenarioDir = join(root, 'e2e/example');
  const projectDir = join(scenarioDir, 'project');
  const stdout = captureStream();
  const stderr = captureStream();

  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'package.json'), '{"type":"module"}\n');
  await writeFile(join(scenarioDir, 'scenario.json'), JSON.stringify({
    command: process.execPath,
    args: ['-e', 'console.log("actual")'],
    expect: {
      stdoutIncludes: ['missing'],
    },
  }, null, 2));

  const code = await main([
    'command',
    '--scenario',
    'e2e/example',
    '--repo-root',
    root,
  ], {
    cwd: root,
    env: { PATH: process.env.PATH },
    stdout,
    stderr,
  });

  assert.equal(code, 1);
  assert.equal(stdout.value, '');
  assert.match(stderr.value, /Command E2E test failed for example/);
  assert.match(stderr.value, /Expected stdout to include "missing"/);
});

function captureStream() {
  return {
    value: '',
    write(chunk) {
      this.value += chunk;
    },
  };
}
