import { lstat, mkdtemp, readFile, readlink, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPackage = '@agent-doc-rules/skill';
const skillName = 'agent-doc-rules';
const skillsCliVersion = process.env.SKILLS_CLI_VERSION ?? '1.5.12';
const requireFromRoot = createRequire(join(repoRoot, 'package.json'));
const skillPackageJson = requireFromRoot.resolve(`${skillPackage}/package.json`);
const skillDir = dirname(skillPackageJson);
const expectedSource = relative(repoRoot, skillDir).replaceAll('\\', '/');

await assertFile(join(skillDir, 'SKILL.md'));
await assertFile(join(repoRoot, '.agents/skills', skillName, 'SKILL.md'));
await assertAgentSkillSymlink(skillDir);
await assertSkillsLock(expectedSource);
await assertSkillsDiscovery(skillDir);

console.log(`Verified ${skillPackage} install wiring for ${skillName}.`);

async function assertSkillsDiscovery(sourceDir) {
  const npmCache = await mkdtemp(join(tmpdir(), 'agent-doc-rules-npm-cache-'));

  try {
    const { stdout } = await run('npx', [
      '-y',
      `skills@${skillsCliVersion}`,
      'add',
      sourceDir,
      '--list',
    ], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
        npm_config_cache: npmCache,
      },
    });

    if (!stdout.includes(skillName)) {
      throw new Error(`skills add --list did not discover ${skillName}`);
    }
  } finally {
    await rm(npmCache, { recursive: true, force: true });
  }
}

async function assertSkillsLock(expectedSourcePath) {
  const lock = JSON.parse(await readFile(join(repoRoot, 'skills-lock.json'), 'utf8'));
  const entry = lock.skills?.[skillName];

  if (!entry) {
    throw new Error(`skills-lock.json does not contain ${skillName}`);
  }

  if (entry.source !== expectedSourcePath) {
    throw new Error(`Expected skills-lock source ${expectedSourcePath}, got ${entry.source}`);
  }
}

async function assertAgentSkillSymlink(expectedTarget) {
  const linkPath = join(repoRoot, '.agents/skills', skillName);
  const info = await lstat(linkPath).catch(() => undefined);

  if (!info?.isSymbolicLink()) {
    throw new Error(`Expected ${linkPath} to be a symlink`);
  }

  const actualTarget = resolve(dirname(linkPath), await readlink(linkPath));

  if (actualTarget !== expectedTarget) {
    throw new Error(`Expected ${linkPath} to point to ${expectedTarget}, got ${actualTarget}`);
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
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit ${code}\n${stderr}\n${stdout}`));
    });
  });
}
