import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assertFile } from './project-files.mjs';
import { runCommand } from './process.mjs';

export async function installSkill({
  projectDir,
  skillSource,
  skillName,
  skillsCliVersion = '1.5.12',
  installedSkillPath = `.agents/skills/${skillName}/SKILL.md`,
  npmCacheDir,
  baseEnv = process.env,
  run = runCommand,
}) {
  const cacheDir = npmCacheDir
    ? npmCacheDir
    : await mkdtemp(join(dirname(projectDir), '.agent-e2e-npm-cache-'));

  if (npmCacheDir) {
    await mkdir(cacheDir, { recursive: true });
  }

  try {
    await run('npx', [
      '-y',
      `skills@${skillsCliVersion}`,
      'add',
      skillSource,
      '--skill',
      skillName,
      '-a',
      'codex',
      '-y',
      '--copy',
    ], '', {
      cwd: projectDir,
      env: {
        ...baseEnv,
        CI: '1',
        NO_COLOR: '1',
        npm_config_cache: cacheDir,
      },
    });
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }

  await assertFile(join(projectDir, installedSkillPath));
  await assertFile(join(projectDir, 'skills-lock.json'));
}
