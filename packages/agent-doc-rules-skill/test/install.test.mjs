import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  readdir,
  rename as move,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installTransaction, validateSkillNames } from '../bin/install.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = join(packageRoot, 'bin/install.mjs');

const skillNames = [
  'agent-doc-rules',
  'docs-duplicate-review',
];

test('accepts only safe unique skill directory names', () => {
  assert.deepEqual(validateSkillNames(skillNames), skillNames);

  for (const invalidNames of [
    [],
    ['', 'docs-duplicate-review'],
    ['agent-doc-rules', 'agent-doc-rules'],
    ['../agent-doc-rules'],
    ['Agent Doc Rules'],
  ]) {
    assert.throws(
      () => validateSkillNames(invalidNames),
      /agentDocRules\.localSkills/,
    );
  }
});

test('installs both skills into the default project path', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Installed @buresmi7\/agent-doc-rules-skill@/);
  assert.match(result.stdout, /agent-doc-rules, docs-duplicate-review/);

  const skillsRoot = join(projectDir, '.agents/skills');
  const rulesTarget = join(skillsRoot, 'agent-doc-rules');
  const duplicateTarget = join(skillsRoot, 'docs-duplicate-review');
  const rulesSkill = await readFile(join(rulesTarget, 'SKILL.md'), 'utf8');
  const duplicateSkill = await readFile(join(duplicateTarget, 'SKILL.md'), 'utf8');

  assert.deepEqual(await readdir(skillsRoot), skillNames);
  assert.match(rulesSkill, /^name: agent-doc-rules$/m);
  assert.match(duplicateSkill, /^name: docs-duplicate-review$/m);
  await assertPath(join(rulesTarget, 'references/security-review.md'));
  await assertPath(join(rulesTarget, 'references/writing-style.md'));
  await assertPath(join(rulesTarget, 'assets/templates/AGENTS.project.md'));
  await assertPath(join(duplicateTarget, 'references/classification-rubric.md'));
  await assert.rejects(stat(join(rulesTarget, 'e2e')), { code: 'ENOENT' });
  await assert.rejects(stat(join(rulesTarget, 'test')), { code: 'ENOENT' });
});

test('rejects a default skills symlink that escapes the current project', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  const projectDir = join(fixtureRoot, 'project');
  const outsideSkills = join(fixtureRoot, 'outside-skills');
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(join(projectDir, '.agents'), { recursive: true });
  await writeMarker(join(outsideSkills, 'team-skill'), 'keep unrelated\n');
  await symlink(outsideSkills, join(projectDir, '.agents/skills'));

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /must resolve within the current project/);
  assert.equal(
    await readFile(join(outsideSkills, 'team-skill/marker.txt'), 'utf8'),
    'keep unrelated\n',
  );
  await assert.rejects(stat(join(outsideSkills, 'agent-doc-rules')), { code: 'ENOENT' });
  await assert.rejects(stat(join(outsideSkills, 'docs-duplicate-review')), { code: 'ENOENT' });
});

test('rejects an explicit target whose existing ancestor escapes the current project', async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  const projectDir = join(fixtureRoot, 'project');
  const outsideDir = join(fixtureRoot, 'outside');
  const target = join(projectDir, 'vendor/skills');
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(projectDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await symlink(outsideDir, join(projectDir, 'vendor'));

  const result = await runInstaller(['--target', target], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /must resolve within the current project/);
  await assert.rejects(stat(join(outsideDir, 'skills')), { code: 'ENOENT' });
});

test('rejects a broken target ancestor symlink without replacing it', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  const agentsLink = join(projectDir, '.agents');
  t.after(() => rm(projectDir, { recursive: true, force: true }));
  await symlink('missing-agents', agentsLink);

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /cannot resolve target path/);
  assert.ok((await lstat(agentsLink)).isSymbolicLink());
  await assert.rejects(stat(join(projectDir, 'missing-agents')), { code: 'ENOENT' });
});

test('allows an in-project target symlink and preserves unrelated skills', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  const actualAgents = join(projectDir, 'config/agents');
  const skillsRoot = join(actualAgents, 'skills');
  const unrelatedTarget = join(skillsRoot, 'team-skill');
  t.after(() => rm(projectDir, { recursive: true, force: true }));
  await writeMarker(unrelatedTarget, 'keep unrelated\n');
  await symlink(actualAgents, join(projectDir, '.agents'));

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 0, result.stderr);
  await assertPath(join(skillsRoot, 'agent-doc-rules/SKILL.md'));
  await assertPath(join(skillsRoot, 'docs-duplicate-review/SKILL.md'));
  assert.equal(
    await readFile(join(unrelatedTarget, 'marker.txt'), 'utf8'),
    'keep unrelated\n',
  );
});

test('runs through a package-bin style symlink', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const binDir = join(projectDir, 'node_modules/.bin');
  const linkedInstaller = join(binDir, 'agent-doc-rules-skill');
  await mkdir(binDir, { recursive: true });
  await symlink(installer, linkedInstaller);

  const result = await runInstaller([], projectDir, linkedInstaller);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Installed @buresmi7\/agent-doc-rules-skill@/);
  await assertPath(join(projectDir, '.agents/skills/agent-doc-rules/SKILL.md'));
  await assertPath(join(projectDir, '.agents/skills/docs-duplicate-review/SKILL.md'));
});

test('a conflict prevents either skill from being installed', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const skillsRoot = join(projectDir, '.agents/skills');
  const duplicateTarget = join(skillsRoot, 'docs-duplicate-review');
  const unrelatedTarget = join(skillsRoot, 'team-skill');
  await mkdir(duplicateTarget, { recursive: true });
  await mkdir(unrelatedTarget, { recursive: true });
  await writeFile(join(duplicateTarget, 'marker.txt'), 'keep duplicate\n');
  await writeFile(join(unrelatedTarget, 'marker.txt'), 'keep unrelated\n');

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Skill target already exists/);
  assert.match(result.stderr, /docs-duplicate-review/);
  await assert.rejects(stat(join(skillsRoot, 'agent-doc-rules')), { code: 'ENOENT' });
  assert.equal(
    await readFile(join(duplicateTarget, 'marker.txt'), 'utf8'),
    'keep duplicate\n',
  );
  assert.equal(
    await readFile(join(unrelatedTarget, 'marker.txt'), 'utf8'),
    'keep unrelated\n',
  );
});

test('treats a broken owned-skill symlink as a conflict', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const skillsRoot = join(projectDir, '.agents/skills');
  const duplicateTarget = join(skillsRoot, 'docs-duplicate-review');
  await mkdir(skillsRoot, { recursive: true });
  await symlink('missing-skill', duplicateTarget);

  const result = await runInstaller([], projectDir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Skill target already exists/);
  assert.ok((await lstat(duplicateTarget)).isSymbolicLink());
  await assert.rejects(stat(join(skillsRoot, 'agent-doc-rules')), { code: 'ENOENT' });
});

test('force replaces both owned skills and preserves unrelated skills', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const skillsRoot = join(projectDir, '.agents/skills');
  const rulesTarget = join(skillsRoot, 'agent-doc-rules');
  const duplicateTarget = join(skillsRoot, 'docs-duplicate-review');
  const unrelatedTarget = join(skillsRoot, 'team-skill');

  for (const target of [rulesTarget, duplicateTarget, unrelatedTarget]) {
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'marker.txt'), `${target}\n`);
  }

  const result = await runInstaller(['--force'], projectDir);

  assert.equal(result.code, 0, result.stderr);
  await assertPath(join(rulesTarget, 'SKILL.md'));
  await assertPath(join(duplicateTarget, 'SKILL.md'));
  await assert.rejects(stat(join(rulesTarget, 'marker.txt')), { code: 'ENOENT' });
  await assert.rejects(stat(join(duplicateTarget, 'marker.txt')), { code: 'ENOENT' });
  await assertPath(join(unrelatedTarget, 'marker.txt'));
});

test('supports dry-run with an explicit skills directory', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const target = join(projectDir, 'vendor/skills');
  const result = await runInstaller(['install', '--dry-run', '--target', target], projectDir);

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Would install @buresmi7\/agent-doc-rules-skill@/);
  assert.match(result.stdout, /agent-doc-rules, docs-duplicate-review/);
  await assert.rejects(stat(target), { code: 'ENOENT' });
});

test('rejects empty target values without modifying owned-looking directories', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const rulesTarget = join(projectDir, 'agent-doc-rules');
  const duplicateTarget = join(projectDir, 'docs-duplicate-review');
  await writeMarker(rulesTarget, 'keep rules\n');
  await writeMarker(duplicateTarget, 'keep duplicate\n');

  for (const targetArg of ['--target=', '--target=   ']) {
    const result = await runInstaller(['--force', targetArg], projectDir);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /--target requires a path value/);
  }

  assert.equal(await readFile(join(rulesTarget, 'marker.txt'), 'utf8'), 'keep rules\n');
  assert.equal(
    await readFile(join(duplicateTarget, 'marker.txt'), 'utf8'),
    'keep duplicate\n',
  );
});

test('rejects arbitrary and owned-skill force targets and preserves their contents', async (t) => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-install-'));
  t.after(() => rm(projectDir, { recursive: true, force: true }));

  const arbitraryTarget = join(projectDir, 'working-copy');
  const rulesTarget = join(arbitraryTarget, 'agent-doc-rules');
  const duplicateTarget = join(arbitraryTarget, 'docs-duplicate-review');
  await writeMarker(rulesTarget, 'keep rules\n');
  await writeMarker(duplicateTarget, 'keep duplicate\n');

  for (const unsafeTarget of [arbitraryTarget, rulesTarget]) {
    const result = await runInstaller(['--force', '--target', unsafeTarget], projectDir);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /parent directory named "skills"/);
  }

  assert.equal(await readFile(join(rulesTarget, 'marker.txt'), 'utf8'), 'keep rules\n');
  assert.equal(
    await readFile(join(duplicateTarget, 'marker.txt'), 'utf8'),
    'keep duplicate\n',
  );
});

test('restores every owned skill after a mid-install failure', async (t) => {
  const target = await mkdtemp(join(tmpdir(), 'agent-doc-rules-skills-'));
  const skillsTarget = join(target, 'skills');
  t.after(() => rm(target, { recursive: true, force: true }));
  await mkdir(skillsTarget);
  await writeMarker(join(skillsTarget, skillNames[0]), 'original rules\n');
  await writeMarker(join(skillsTarget, skillNames[1]), 'original duplicate\n');

  let stagedMoves = 0;
  const injectedRename = async (from, to) => {
    if (basename(dirname(from)) === 'staged') {
      stagedMoves += 1;

      if (stagedMoves === 2) {
        throw new Error('injected staged move failure');
      }
    }

    await move(from, to);
  };

  await assert.rejects(
    installTransaction({
      conflicts: skillNames,
      skillNames,
      target: skillsTarget,
      operations: { rename: injectedRename },
    }),
    /Installation failed and was rolled back: injected staged move failure/,
  );

  assert.equal(
    await readFile(join(skillsTarget, skillNames[0], 'marker.txt'), 'utf8'),
    'original rules\n',
  );
  assert.equal(
    await readFile(join(skillsTarget, skillNames[1], 'marker.txt'), 'utf8'),
    'original duplicate\n',
  );
  assert.deepEqual(await readdir(skillsTarget), skillNames);
});

test('retains backups and reports their path when rollback is incomplete', async (t) => {
  const target = await mkdtemp(join(tmpdir(), 'agent-doc-rules-skills-'));
  const skillsTarget = join(target, 'skills');
  t.after(() => rm(target, { recursive: true, force: true }));
  await mkdir(skillsTarget);
  await writeMarker(join(skillsTarget, skillNames[0]), 'original rules\n');
  await writeMarker(join(skillsTarget, skillNames[1]), 'original duplicate\n');

  let stagedMoves = 0;
  const restoreAttempts = [];
  const injectedRename = async (from, to) => {
    const parentName = basename(dirname(from));

    if (parentName === 'staged') {
      stagedMoves += 1;

      if (stagedMoves === 2) {
        throw new Error('injected staged move failure');
      }
    }

    if (parentName === 'backup') {
      restoreAttempts.push(basename(from));

      if (basename(from) === skillNames[1]) {
        throw new Error('injected restore failure');
      }
    }

    await move(from, to);
  };

  let installationError;

  try {
    await installTransaction({
      conflicts: skillNames,
      skillNames,
      target: skillsTarget,
      operations: { rename: injectedRename },
    });
  } catch (error) {
    installationError = error;
  }

  assert.ok(installationError instanceof Error);
  assert.match(installationError.message, /Rollback was incomplete/);
  assert.match(installationError.message, /restore backup for docs-duplicate-review/);
  assert.deepEqual(restoreAttempts, [...skillNames].reverse());

  const transactionNames = (await readdir(skillsTarget)).filter((name) => (
    name.startsWith('.agent-doc-rules-install-')
  ));
  assert.equal(transactionNames.length, 1);

  const transactionRoot = join(skillsTarget, transactionNames[0]);
  const backupRoot = join(transactionRoot, 'backup');
  assert.match(installationError.message, new RegExp(escapeRegExp(transactionRoot)));
  assert.match(installationError.message, new RegExp(escapeRegExp(backupRoot)));
  assert.equal(
    await readFile(join(skillsTarget, skillNames[0], 'marker.txt'), 'utf8'),
    'original rules\n',
  );
  await assert.rejects(stat(join(skillsTarget, skillNames[1])), { code: 'ENOENT' });
  assert.equal(
    await readFile(join(backupRoot, skillNames[1], 'marker.txt'), 'utf8'),
    'original duplicate\n',
  );
});

test('reports the install and cleanup failures without hiding rollback state', async (t) => {
  const target = await mkdtemp(join(tmpdir(), 'agent-doc-rules-skills-'));
  const skillsTarget = join(target, 'skills');
  t.after(() => rm(target, { recursive: true, force: true }));
  await mkdir(skillsTarget);

  let stagedMoves = 0;
  const injectedRename = async (from, to) => {
    if (basename(dirname(from)) === 'staged') {
      stagedMoves += 1;

      if (stagedMoves === 2) {
        throw new Error('injected staged move failure');
      }
    }

    await move(from, to);
  };
  const injectedRemove = async (path, options) => {
    if (basename(path).startsWith('.agent-doc-rules-install-')) {
      throw new Error('injected cleanup failure');
    }

    await rm(path, options);
  };

  await assert.rejects(
    installTransaction({
      conflicts: [],
      skillNames,
      target: skillsTarget,
      operations: {
        rename: injectedRename,
        rm: injectedRemove,
      },
    }),
    (error) => {
      assert.match(error.message, /injected staged move failure/);
      assert.match(error.message, /Rollback succeeded/);
      assert.match(error.message, /injected cleanup failure/);
      assert.match(error.message, /Transaction may remain at/);
      return true;
    },
  );

  for (const skillName of skillNames) {
    await assert.rejects(stat(join(skillsTarget, skillName)), { code: 'ENOENT' });
  }

  assert.equal(
    (await readdir(skillsTarget)).filter((name) => (
      name.startsWith('.agent-doc-rules-install-')
    )).length,
    1,
  );
});

async function assertPath(path) {
  const info = await stat(path);
  assert.ok(info.isFile() || info.isDirectory(), `${path} should exist`);
}

async function writeMarker(target, contents) {
  await mkdir(target, { recursive: true });
  await writeFile(join(target, 'marker.txt'), contents);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function runInstaller(args, cwd, executable = installer) {
  return new Promise((resolveResult) => {
    execFile(process.execPath, [executable, ...args], {
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
