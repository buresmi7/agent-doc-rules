import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildCodexArgs,
  buildCodexProcessEnv,
  prepareIsolatedCodexHome,
} from './agent-runtime.mjs';

test('buildCodexArgs keeps Codex agent E2E isolated from local rules', () => {
  const args = buildCodexArgs({
    codexModel: 'gpt-test',
    codexReasoningEffort: 'medium',
  }, {
    schemaFile: '/tmp/schema.json',
    outputFile: '/tmp/output.json',
    cwd: '/tmp/project',
  });

  assert.deepEqual(args.slice(0, 6), [
    'exec',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-rules',
    '--sandbox',
    'read-only',
  ]);
  assert.deepEqual(args.slice(-3), ['--cd', '/tmp/project', '-']);
  assert.ok(args.includes('--model'));
  assert.ok(args.includes('gpt-test'));
  assert.ok(args.includes('--config'));
  assert.ok(args.includes('model_reasoning_effort="medium"'));
});

test('prepareIsolatedCodexHome copies auth without copying local config or rules', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'agent-e2e-codex-home-'));
  const sourceCodexHome = join(tempDir, 'source-codex-home');

  await mkdir(sourceCodexHome, { recursive: true });
  await writeFile(join(sourceCodexHome, 'auth.json'), '{"token":"test"}\n');
  await writeFile(join(sourceCodexHome, 'config.toml'), 'model = "local-model"\n');
  await writeFile(join(sourceCodexHome, 'AGENTS.md'), '# Local maintainer rules\n');

  const isolatedCodexHome = await prepareIsolatedCodexHome({
    tempDir,
    sourceCodexHome,
    codexModel: 'gpt-test',
  });

  assert.equal(await readFile(join(isolatedCodexHome, 'auth.json'), 'utf8'), '{"token":"test"}\n');

  const isolatedConfig = await readFile(join(isolatedCodexHome, 'config.toml'), 'utf8');
  assert.match(isolatedConfig, /model = "gpt-test"/);
  assert.doesNotMatch(isolatedConfig, /local-model/);

  await assert.rejects(
    () => access(join(isolatedCodexHome, 'AGENTS.md')),
    /ENOENT/,
  );
});

test('buildCodexProcessEnv points Codex at the isolated home', () => {
  const env = buildCodexProcessEnv({ CODEX_HOME: '/old', PATH: '/bin' }, '/isolated');

  assert.equal(env.CODEX_HOME, '/isolated');
  assert.equal(env.PATH, '/bin');
  assert.equal(env.NO_COLOR, '1');
});
