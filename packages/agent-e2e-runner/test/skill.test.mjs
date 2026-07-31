import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { installSkill } from '../src/skill.mjs';

test('installSkill keeps its npm cache in the selected run directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-skill-'));
  const projectDir = join(root, 'project');
  const npmCacheDir = join(root, 'npm-cache');
  let invocation;

  await mkdir(projectDir);

  await installSkill({
    projectDir,
    skillSource: '/skills/example',
    skillName: 'example',
    npmCacheDir,
    baseEnv: { PATH: '/bin' },
    run: async (command, args, input, options) => {
      invocation = { command, args, input, options };
      await access(npmCacheDir);
      await mkdir(join(projectDir, '.agents/skills/example'), { recursive: true });
      await writeFile(
        join(projectDir, '.agents/skills/example/SKILL.md'),
        '# Example\n',
      );
      await writeFile(join(projectDir, 'skills-lock.json'), '{}\n');
    },
  });

  assert.equal(invocation.command, 'npx');
  assert.ok(invocation.args.includes('skills@1.5.12'));
  assert.equal(invocation.options.env.npm_config_cache, npmCacheDir);
  assert.equal(invocation.options.env.PATH, '/bin');
  await assert.rejects(() => access(npmCacheDir), /ENOENT/);
});

test('installSkill creates its default npm cache beside the project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-skill-default-'));
  const projectDir = join(root, 'project');
  let npmCacheDir;

  await mkdir(projectDir);

  await installSkill({
    projectDir,
    skillSource: '/skills/example',
    skillName: 'example',
    run: async (_command, _args, _input, options) => {
      npmCacheDir = options.env.npm_config_cache;
      await mkdir(join(projectDir, '.agents/skills/example'), { recursive: true });
      await writeFile(
        join(projectDir, '.agents/skills/example/SKILL.md'),
        '# Example\n',
      );
      await writeFile(join(projectDir, 'skills-lock.json'), '{}\n');
    },
  });

  assert.equal(dirname(npmCacheDir), root);
  assert.match(basename(npmCacheDir), /^\.agent-e2e-npm-cache-/);
  await assert.rejects(() => access(npmCacheDir), /ENOENT/);
});
