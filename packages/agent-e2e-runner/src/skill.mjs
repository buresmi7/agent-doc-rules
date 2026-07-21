import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertFile } from './project-files.mjs';
import { runCommand } from './process.mjs';

export async function installSkill({
  projectDir,
  skillSource,
  skillName,
  skillsCliVersion = '1.5.12',
  installedSkillPath = `.agents/skills/${skillName}/SKILL.md`,
  baseEnv = process.env,
}) {
  const npmCache = await mkdtemp(join(tmpdir(), 'agent-e2e-npm-cache-'));

  try {
    await runCommand('npx', [
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
        npm_config_cache: npmCache,
      },
    });
  } finally {
    await rm(npmCache, { recursive: true, force: true });
  }

  await assertFile(join(projectDir, installedSkillPath));
  await assertFile(join(projectDir, 'skills-lock.json'));
}
