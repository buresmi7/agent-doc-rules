import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = join(packageRoot, 'bin/install.mjs');

test('installs the skill into the default project path', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Installed @buresmi7\/agent-doc-rules-skill@/);

  const target = join(projectDir, '.agents/skills/agent-doc-rules');
  const skill = await readFile(join(target, 'SKILL.md'), 'utf8');

  assert.match(skill, /^name: agent-doc-rules$/m);
  await assertPath(join(target, 'README.md'));
  await assertPath(join(target, 'references/security-review.md'));
  await assertPath(join(target, 'assets/templates/AGENTS.project.md'));
  await assert.rejects(stat(join(target, 'test')), { code: 'ENOENT' });
});

test('refuses to overwrite an existing target without force', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const target = join(projectDir, '.agents/skills/agent-doc-rules');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'marker.txt'), 'keep me\n');

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Target already exists/);
  assert.equal(await readFile(join(target, 'marker.txt'), 'utf8'), 'keep me\n');
});

test('replaces an existing target with force', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const target = join(projectDir, '.agents/skills/agent-doc-rules');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'marker.txt'), 'remove me\n');

  const result = await runInstaller(['--force'], projectDir);

  assert.equal(result.code, 0, result.stderr);
  await assertPath(join(target, 'SKILL.md'));
  await assert.rejects(stat(join(target, 'marker.txt')), { code: 'ENOENT' });
});

test('supports dry-run with an explicit target', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const target = join(projectDir, 'vendor/agent-doc-rules');
  const result = await runInstaller(['install', '--dry-run', '--target', target], projectDir);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Would install @buresmi7\/agent-doc-rules-skill@/);
  await assert.rejects(stat(target), { code: 'ENOENT' });
});

test('rejects unsafe target names', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const result = await runInstaller(['--target', projectDir], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Target directory must be named agent-doc-rules/);
});

async function assertPath(path) {
  const info = await stat(path);
  assert.ok(info.isFile() || info.isDirectory(), `${path} should exist`);
}

function runInstaller(args, cwd) {
  return new Promise((resolveResult) => {
    execFile(process.execPath, [installer, ...args], {
      cwd,
      env: {
        ...process.env,
        NO_COLOR: '1',
      },
    }, (error, stdout, stderr) => {
      resolveResult({
        code: error?.code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}
