import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertFile } from './project-files.mjs';
import { runCommand } from './process.mjs';

export async function installSkill({
  projectDir,
  skillSource,
  skillName,
  skillsCliVersion,
  keepOutput,
}) {
  const npmCache = await mkdtemp(join(tmpdir(), 'agent-doc-rules-npm-cache-'));

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
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
        npm_config_cache: npmCache,
      },
    });
  } finally {
    if (!keepOutput) {
      await rm(npmCache, { recursive: true, force: true });
    }
  }

  await assertFile(join(projectDir, '.agents/skills/agent-doc-rules/SKILL.md'));
  await assertFile(join(projectDir, 'skills-lock.json'));
}

export async function readSkillUsePrompt({
  scenarioDir,
  skillSource,
  skillName,
  skillsCliVersion,
  skillReference,
  keepOutput,
}) {
  const npmCache = await mkdtemp(join(tmpdir(), 'agent-doc-rules-npm-cache-'));

  try {
    const { stdout } = await runCommand('npx', [
      '-y',
      `skills@${skillsCliVersion}`,
      'use',
      skillSource,
      '--skill',
      skillName,
    ], '', {
      cwd: scenarioDir,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
        npm_config_cache: npmCache,
      },
    });

    return `${stdout.trim()}\n\nSkill source files:\n\n${skillReference}`;
  } finally {
    if (!keepOutput) {
      await rm(npmCache, { recursive: true, force: true });
    }
  }
}

export async function readSkillReference(skillSource) {
  const files = [
    'SKILL.md',
    'references/agents-rules.md',
    'references/agents-rubric.md',
    'references/doc-audit.md',
    'references/readme-rules.md',
    'references/documentation-architecture.md',
    'references/readme-rubric.md',
    'references/factual-review.md',
    'references/validation.md',
    'references/writing-style.md',
    'docs/context-placement.md',
    'assets/templates/AGENTS.project.md',
    'assets/templates/AGENTS.overlay.md',
  ];
  const chunks = [];

  for (const file of files) {
    chunks.push(`--- @buresmi7/agent-doc-rules-skill/${file} ---\n${await readFile(join(skillSource, file), 'utf8')}`);
  }

  return chunks.join('\n\n');
}
