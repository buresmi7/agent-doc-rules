import assert from 'node:assert/strict';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  installProjectDependencies,
  readProjectSkillDefinition,
} from '../src/project-package.mjs';

const selectedSkill = {
  packageName: '@example/todo-skill',
  name: 'todo-cleaner',
};

test('readProjectSkillDefinition reads the selected dependency from project/package.json', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-e2e-project-package-'));

  await writeProjectPackage(projectDir, {
    devDependencies: {
      '@example/todo-skill': 'workspace:*',
    },
  });

  assert.deepEqual(await readProjectSkillDefinition(projectDir, selectedSkill), {
    name: 'todo-cleaner',
    packageName: '@example/todo-skill',
    packageSpec: 'workspace:*',
    installedSkillPath: '.agents/skills/todo-cleaner/SKILL.md',
  });
});

test('readProjectSkillDefinition requires the selected package as a dependency', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-e2e-project-package-missing-'));

  await writeProjectPackage(projectDir, {
  });

  await assert.rejects(
    () => readProjectSkillDefinition(projectDir, selectedSkill),
    /must be listed in project\/package\.json dependencies/,
  );
});

test('readProjectSkillDefinition rejects unsafe skill names', async () => {
  const projectDir = await mkdtemp(join(tmpdir(), 'agent-e2e-project-package-name-'));

  await writeProjectPackage(projectDir, {
    devDependencies: {
      '@example/todo-skill': '1.0.0',
    },
  });

  await assert.rejects(
    () => readProjectSkillDefinition(projectDir, {
      ...selectedSkill,
      name: '../todo-cleaner',
    }),
    /must use 1-64 lowercase letters, numbers, and single hyphens/,
  );
});

test('installProjectDependencies installs a relative file dependency in the temporary project', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-project-install-'));
  const projectFixtureDir = join(root, 'fixture');
  const projectDir = join(root, 'temporary-project');
  const skillDir = join(root, 'todo-skill');

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillDir, { recursive: true });
  await writeProjectPackage(skillDir, {
    name: '@example/todo-skill',
    version: '1.0.0',
    exports: './SKILL.md',
  });
  await writeFile(join(skillDir, 'SKILL.md'), '# Todo Cleaner\n');
  await writeProjectPackage(projectFixtureDir, {
    name: 'todo-fixture',
    version: '0.0.0',
    private: true,
    packageManager: 'npm@10.9.0',
    devDependencies: {
      '@example/todo-skill': 'file:../todo-skill',
    },
  });
  await cp(projectFixtureDir, projectDir, { recursive: true });

  const originalPackage = await readFile(join(projectDir, 'package.json'), 'utf8');
  const skill = await readProjectSkillDefinition(projectFixtureDir, selectedSkill);
  const result = await installProjectDependencies({
    projectDir,
    projectFixtureDir,
    repoRoot: root,
    skill,
  });

  assert.equal(result.packageManager, 'npm');
  assert.equal(await readFile(join(result.skillSource, 'SKILL.md'), 'utf8'), '# Todo Cleaner\n');
  assert.equal(await readFile(join(projectDir, 'package.json'), 'utf8'), originalPackage);
  await assert.rejects(
    () => access(join(projectDir, 'package-lock.json')),
    /ENOENT/,
  );
});

test('installProjectDependencies resolves workspace dependencies before temporary installation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-workspace-install-'));
  const projectFixtureDir = join(root, 'fixture');
  const projectDir = join(root, 'temporary-project');
  const skillDir = join(root, 'packages/todo-skill');
  const fixtureDependencyDir = join(
    projectFixtureDir,
    'node_modules/@example/todo-skill',
  );

  await writeProjectPackage(root, {
    name: 'example-workspace',
    private: true,
    packageManager: 'pnpm@11.8.0',
  });
  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillDir, { recursive: true });
  await writeProjectPackage(skillDir, {
    name: '@example/todo-skill',
    version: '1.0.0',
  });
  await writeFile(join(skillDir, 'SKILL.md'), '# Todo Cleaner\n');
  await writeProjectPackage(projectFixtureDir, {
    name: 'todo-fixture',
    version: '0.0.0',
    private: true,
    devDependencies: {
      '@example/todo-skill': 'workspace:*',
    },
  });
  await mkdir(join(projectFixtureDir, 'node_modules/@example'), { recursive: true });
  await symlink(skillDir, fixtureDependencyDir, 'dir');
  await cp(projectFixtureDir, projectDir, {
    recursive: true,
    filter: (source) => !source.includes('/node_modules'),
  });

  const skill = await readProjectSkillDefinition(projectFixtureDir, selectedSkill);
  const result = await installProjectDependencies({
    projectDir,
    projectFixtureDir,
    repoRoot: root,
    skill,
    run: async (command, args, _input, { cwd }) => {
      const manifest = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
      assert.equal(command, 'corepack');
      assert.deepEqual(args, ['pnpm', 'install', '--no-frozen-lockfile']);
      assert.equal(manifest.packageManager, 'pnpm@11.8.0');
      assert.equal(
        manifest.devDependencies['@example/todo-skill'],
        `file:${skillDir}`,
      );
      await mkdir(join(cwd, 'node_modules/@example'), { recursive: true });
      await symlink(skillDir, join(cwd, 'node_modules/@example/todo-skill'), 'dir');
    },
  });

  assert.equal(result.skillSource, skillDir);
});

async function writeProjectPackage(projectDir, manifest) {
  await writeFile(
    join(projectDir, 'package.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
