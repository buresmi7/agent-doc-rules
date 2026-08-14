import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  externalProjectSkillSources,
  externalProjectSkills,
  localWorkspaceSkill,
  nodeModulesProjectSkills,
  skillsCliVersion,
} from './project-skills.mjs';
import { computeVersionedDirectoryHash } from './versioned-directory-hash.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPackage = localWorkspaceSkill.packageName;
const skillName = localWorkspaceSkill.name;
const requireFromRoot = createRequire(join(repoRoot, 'package.json'));
const skillPackageJson = requireFromRoot.resolve(`${skillPackage}/package.json`);
const skillDir = await realpath(dirname(skillPackageJson));
const targetDir = join(repoRoot, '.agents/skills', skillName);
const targetParent = dirname(targetDir);
const lockPath = join(repoRoot, 'skills-lock.json');
const originalLockContent = await readFile(lockPath, 'utf8').catch(() => undefined);

await mkdir(targetParent, { recursive: true });
await syncExternalProjectSkillsSafely();
await syncNodeModulesProjectSkills();
await syncLocalWorkspaceSkill();

console.log(`Synced ${skillPackage} and ${externalProjectSkills.length} external project skills.`);

async function syncExternalProjectSkills() {
  for (const source of externalProjectSkillSources) {
    let checkoutDir;

    try {
      checkoutDir = await checkoutExternalProjectSkillSource(source);

      await run('npx', [
        '-y',
        `skills@${skillsCliVersion}`,
        'add',
        checkoutDir ?? source.source,
        ...source.skills.flatMap((skill) => ['--skill', skill.name]),
        '-a',
        'codex',
        '-y',
        '--copy',
      ], {
        cwd: repoRoot,
        env: {
          ...process.env,
          CI: '1',
          NO_COLOR: '1',
        },
      });
    } finally {
      if (checkoutDir) {
        await rm(checkoutDir, { recursive: true, force: true });
      }
    }
  }
}

async function syncExternalProjectSkillsSafely() {
  try {
    await syncExternalProjectSkills();
    await assertExternalSkillsLockUnchanged();
  } finally {
    if (originalLockContent) {
      await writeFile(lockPath, originalLockContent);
    }
  }
}

async function checkoutExternalProjectSkillSource(source) {
  if (!source.revision) {
    return undefined;
  }

  const checkoutDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-github-skill-'));

  try {
    await run('git', ['init', '--quiet', checkoutDir], { cwd: repoRoot });
    await run('git', [
      '-C',
      checkoutDir,
      'fetch',
      '--quiet',
      '--depth',
      '1',
      githubRepositoryUrl(source.source),
      source.revision,
    ], { cwd: repoRoot });
    await run('git', ['-C', checkoutDir, 'checkout', '--quiet', '--detach', 'FETCH_HEAD'], { cwd: repoRoot });
    return checkoutDir;
  } catch (error) {
    await rm(checkoutDir, { recursive: true, force: true });
    throw error;
  }
}

function githubRepositoryUrl(source) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source)) {
    throw new Error(`Pinned GitHub skill source must use owner/repository syntax: ${source}`);
  }

  return `https://github.com/${source}.git`;
}

async function syncLocalWorkspaceSkill() {
  await assertFile(join(skillDir, 'SKILL.md'));
  await rm(targetDir, { recursive: true, force: true });
  await symlink(relative(targetParent, skillDir), targetDir, directorySymlinkType());
  await normalizeSkillsLock();
  await assertFile(join(targetDir, 'SKILL.md'));
}

async function syncNodeModulesProjectSkills() {
  if (nodeModulesProjectSkills.length === 0) {
    return;
  }

  const skillNodeModules = join(skillDir, 'node_modules');
  const nodeModulesInfo = await stat(skillNodeModules).catch(() => undefined);

  if (!nodeModulesInfo?.isDirectory()) {
    throw new Error(`Expected ${skillNodeModules}. Run corepack pnpm install before syncing project skills.`);
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'agent-doc-rules-skills-sync-'));

  try {
    await writeFile(join(tempDir, 'package.json'), '{"private":true,"type":"module"}\n');
    await symlink(skillNodeModules, join(tempDir, 'node_modules'), directorySymlinkType());

    await run('npx', [
      '-y',
      `skills@${skillsCliVersion}`,
      'experimental_sync',
      '-a',
      'codex',
      '-y',
    ], {
      cwd: tempDir,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
      },
    });

    const generatedLock = JSON.parse(await readFile(join(tempDir, 'skills-lock.json'), 'utf8'));

    for (const skill of nodeModulesProjectSkills) {
      const generatedEntry = generatedLock.skills?.[skill.name];

      if (!generatedEntry) {
        throw new Error(`skills experimental_sync did not discover ${skill.name} from ${skill.source}`);
      }

      if (generatedEntry.source !== skill.source || generatedEntry.sourceType !== 'node_modules') {
        throw new Error(`Unexpected generated lock entry for ${skill.name}`);
      }

      if (generatedEntry.computedHash !== skill.computedHash) {
        throw new Error(
          `Node modules skill ${skill.name} changed. Review ${skill.source}, then update skills-lock.json intentionally.`,
        );
      }

      const sourceDir = join(tempDir, '.agents/skills', skill.name);
      const destinationDir = join(repoRoot, '.agents/skills', skill.name);

      await assertFile(join(sourceDir, 'SKILL.md'));
      await rm(destinationDir, { recursive: true, force: true });
      await cp(sourceDir, destinationDir, { recursive: true });
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function normalizeSkillsLock() {
  const content = await readFile(lockPath, 'utf8').catch(() => undefined);
  const relativeSource = relative(repoRoot, skillDir).replaceAll('\\', '/');

  if (!content) {
    await writeFile(
      lockPath,
      `${JSON.stringify({
        version: 1,
        skills: {
          [skillName]: {
            source: relativeSource,
            sourceType: 'local',
          },
        },
      }, null, 2)}\n`,
    );
    return;
  }

  const lock = JSON.parse(content);
  lock.skills ??= {};
  lock.skills[skillName] ??= {};
  lock.skills[skillName].source = relativeSource;
  lock.skills[skillName].sourceType = 'local';
  lock.skills[skillName].computedHash = await computeVersionedDirectoryHash(repoRoot, skillDir);

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

async function assertExternalSkillsLockUnchanged() {
  if (!originalLockContent) {
    return;
  }

  const lock = JSON.parse(await readFile(lockPath, 'utf8'));

  for (const skill of externalProjectSkills) {
    const entry = lock.skills?.[skill.name];

    if (!entry) {
      throw new Error(`skills-lock.json lost external skill ${skill.name}`);
    }

    if (entry.computedHash !== skill.computedHash) {
      throw new Error(
        `External skill ${skill.name} changed upstream. Review the skill and update skills-lock.json intentionally.`,
      );
    }
  }
}

async function assertFile(path) {
  const info = await stat(path).catch(() => undefined);

  if (!info?.isFile()) {
    throw new Error(`Expected file does not exist: ${path}`);
  }
}

function run(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit ${code}`));
    });
  });
}

function directorySymlinkType() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}
