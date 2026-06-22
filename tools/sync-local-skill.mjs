import { mkdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPackage = '@agent-doc-rules/skill';
const skillName = 'agent-doc-rules';
const skillsCliVersion = process.env.SKILLS_CLI_VERSION ?? '1.5.12';
const requireFromRoot = createRequire(join(repoRoot, 'package.json'));
const skillPackageJson = requireFromRoot.resolve(`${skillPackage}/package.json`);
const skillDir = await realpath(dirname(skillPackageJson));
const targetDir = join(repoRoot, '.agents/skills', skillName);
const targetParent = dirname(targetDir);

await assertFile(join(skillDir, 'SKILL.md'));
await mkdir(targetParent, { recursive: true });
await rm(targetDir, { recursive: true, force: true });

await run('npx', [
  '-y',
  `skills@${skillsCliVersion}`,
  'add',
  skillDir,
  '--skill',
  skillName,
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

await rm(targetDir, { recursive: true, force: true });
await symlink(relative(targetParent, skillDir), targetDir, process.platform === 'win32' ? 'junction' : 'dir');
await normalizeSkillsLock();
await assertFile(join(targetDir, 'SKILL.md'));

console.log(`Synced ${skillPackage} to .agents/skills/${skillName}`);

async function normalizeSkillsLock() {
  const lockPath = join(repoRoot, 'skills-lock.json');
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

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
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
