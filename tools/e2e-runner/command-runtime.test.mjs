import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import test from 'node:test';
import {
  buildCommandScenarioEnv,
  runCommandScenario,
} from './command-runtime.mjs';

test('runCommandScenario accepts an expected nonzero exit code', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-e2e-command-'));
  const result = await runCommandScenario({
    projectDir,
    repoRoot: projectDir,
    env: { PATH: process.env.PATH },
    scenario: {
      command: process.execPath,
      args: ['-e', 'console.error("expected failure"); process.exit(7);'],
      expect: {
        exitCode: 7,
        stderrIncludes: ['expected failure'],
      },
    },
  });

  assert.equal(result.pass, true);
  assert.equal(result.result.code, 7);
});

test('runCommandScenario reports stdout and file expectation failures', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-e2e-command-'));

  await mkdir(join(projectDir, 'docs'), { recursive: true });
  await writeFile(join(projectDir, 'docs/guide.md'), '# Guide\n');

  const result = await runCommandScenario({
    projectDir,
    repoRoot: projectDir,
    env: { PATH: process.env.PATH },
    scenario: {
      command: process.execPath,
      args: ['-e', 'console.log("actual output");'],
      expect: {
        stdoutIncludes: ['missing output'],
        filesExist: ['docs/missing.md'],
        filesDoNotExist: ['docs/guide.md'],
      },
    },
  });

  assert.equal(result.pass, false);
  assert.deepEqual(result.failures, [
    'Expected stdout to include "missing output".',
    'Expected docs/missing.md to exist.',
    'Expected docs/guide.md not to exist.',
  ]);
});

test('buildCommandScenarioEnv prepends repo bins to PATH', () => {
  const env = buildCommandScenarioEnv({
    repoRoot: '/repo',
    env: { PATH: '/usr/bin' },
  });

  assert.equal(env.PATH, `/repo/node_modules/.bin${delimiter}/usr/bin`);
  assert.equal(env.NO_COLOR, '1');
});
