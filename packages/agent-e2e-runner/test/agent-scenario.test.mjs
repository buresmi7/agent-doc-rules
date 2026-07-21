import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runAgentScenario } from '../src/agent-scenario.mjs';

const selectedSkill = {
  packageName: 'test-skill-package',
  name: 'test-skill',
};

test('runAgentScenario runs real project edits through one multi-turn agent session', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-scenario-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');
  const calls = [];
  const progress = [];

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeFile(join(projectFixtureDir, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node --test',
      'test:agent': 'node runner.mjs',
    },
    dependencies: {
      'test-skill-package': '0.0.0',
    },
  }, null, 2));
  await writeScenarioDefinition(scenarioDir, [
    {
      id: 'request',
      prompt: 'Update the README, but ask first.',
      criteria: { 'ask-first': 'Ask before editing.' },
    },
    {
      id: 'confirm',
      prompt: 'Yes, proceed.',
      criteria: { 'update-readme': 'README is updated.' },
    },
  ]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  const result = await runAgentScenario({
    scenarioName: 'example',
    scenarioDir,
    projectFixtureDir,
    repoRoot: root,
    runtime: { runner: 'codex' },
    skill: selectedSkill,
    judgePromptTemplate: '{{criteria}}\n{{originalProjectFiles}}\n{{projectFiles}}\n{{changes}}\n{{transcript}}',
    keepOutput: true,
    updateSnapshots: true,
    onProgress: (event) => progress.push(event),
    createAgentSession: async (_runtime, { cwd }) => ({
      async runTurn(prompt) {
        calls.push(prompt);

        if (calls.length === 1) {
          return {
            response: 'Should I replace the title?',
            activity: [{
              type: 'command_execution',
              commandSummary: 'sed',
              exitCode: 0,
              status: 'completed',
            }],
          };
        }

        await writeFile(join(cwd, 'README.md'), '# Updated\n');
        return { response: `Updated [README](${cwd}/README.md:1).` };
      },
    }),
    judge: async (_runtime, request) => {
      assert.match(request.prompt, /Update the README, but ask first/);
      assert.match(request.prompt, /\[request\.ask-first\] Ask before editing\./);
      assert.match(request.prompt, /Should I replace the title\?/);
      assert.match(request.prompt, /Agent tool activity:/);
      assert.match(request.prompt, /command \(exit 0\)/);
      assert.match(request.prompt, /--- README\.md \(modified\) ---/);
      assert.match(request.prompt, /# Updated/);
      assert.match(request.prompt, /\(<project>\/README\.md:1\)/);
      assert.doesNotMatch(request.prompt, new RegExp(root));
      assert.doesNotMatch(request.prompt, /# Test Skill/);

      return {
        pass: true,
        score: 1,
        failedCriteria: [],
        requiredFixes: [],
        notes: 'Looks good.',
      };
    },
    installProject: async () => ({ skillSource }),
    installProjectSkill: async ({
      projectDir,
      installedSkillPath = '.agents/skills/test-skill/SKILL.md',
    }) => {
      await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
      await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
      await writeFile(join(projectDir, 'skills-lock.json'), '{}\n');
    },
  });

  assert.equal(result.pass, true);
  assert.deepEqual(calls, [
    'Update the README, but ask first.',
    'Yes, proceed.',
  ]);
  assert.deepEqual(progress.map((event) => event.type), [
    'turn:start',
    'turn:complete',
    'turn:start',
    'turn:complete',
    'judge:start',
  ]);
  assert.deepEqual(
    progress.filter((event) => event.id).map((event) => event.id),
    ['request', 'request', 'confirm', 'confirm'],
  );
  assert.equal(
    await readFile(join(result.outputDir, 'project/README.md'), 'utf8'),
    '# Updated\n',
  );
  assert.doesNotMatch(
    await readFile(join(result.outputDir, 'project/package.json'), 'utf8'),
    /test:agent/,
  );
  const metadata = JSON.parse(
    await readFile(join(scenarioDir, 'snapshot/metadata.json'), 'utf8'),
  );
  assert.deepEqual(metadata.skillPackage, {
    name: 'test-skill-package',
    source: '0.0.0',
    skill: 'test-skill',
  });
  await assert.rejects(
    () => access(join(result.outputDir, 'project/skills-lock.json')),
    /ENOENT/,
  );
});

test('runAgentScenario restores a fixture lock and retains turn ids on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-lock-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');
  const fixtureLock = '{"fixture":true}\n';

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeFile(join(projectFixtureDir, 'skills-lock.json'), fixtureLock);
  await writeScenarioDefinition(scenarioDir, [{
    id: 'inspect',
    prompt: 'Inspect the project.',
    criteria: { unchanged: 'Keep the fixture unchanged.' },
  }]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  const result = await runAgentScenario({
    scenarioName: 'fixture-lock',
    scenarioDir,
    projectFixtureDir,
    repoRoot: root,
    runtime: { runner: 'codex' },
    skill: selectedSkill,
    judgePromptTemplate: '{{criteria}}',
    keepOutput: true,
    createAgentSession: async (_runtime, { cwd }) => ({
      async runTurn() {
        assert.equal(await readFile(join(cwd, 'skills-lock.json'), 'utf8'), fixtureLock);
        return { response: 'The fixture is unchanged.' };
      },
    }),
    judge: async () => ({
      pass: false,
      score: 0,
      failedCriteria: [{ id: 'inspect.unchanged', reason: 'Test failure.' }],
      requiredFixes: ['Keep the fixture unchanged.'],
      notes: 'Failed for test coverage.',
    }),
    installProject: async () => ({ skillSource }),
    installProjectSkill: async ({
      projectDir,
      installedSkillPath = '.agents/skills/test-skill/SKILL.md',
    }) => {
      await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
      await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
      await writeFile(join(projectDir, 'skills-lock.json'), '{"generated":true}\n');
    },
  });

  assert.equal(
    await readFile(join(result.outputDir, 'project/skills-lock.json'), 'utf8'),
    fixtureLock,
  );
  const summary = JSON.parse(await readFile(result.failureSummaryPath, 'utf8'));

  assert.equal(result.pass, false);
  assert.deepEqual(summary.turns.map(({ id, source }) => ({ id, source })), [{
    id: 'inspect',
    source: 'scenario.json#/turns/0',
  }]);
});

test('runAgentScenario rejects changes to the installed skill', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-protected-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeScenarioDefinition(scenarioDir, [{
    id: 'change',
    prompt: 'Change the project.',
    criteria: { 'change-project': 'Change the project.' },
  }]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  await assert.rejects(
    () => runAgentScenario({
      scenarioName: 'protected',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      judgePromptTemplate: '{{criteria}}',
      createAgentSession: async (_runtime, { cwd }) => ({
        async runTurn() {
          await writeFile(
            join(cwd, '.agents/skills/test-skill/SKILL.md'),
            '# Modified Skill\n',
          );
          return { response: 'Done.' };
        },
      }),
      installProject: async () => ({ skillSource }),
      installProjectSkill: async ({ projectDir, installedSkillPath }) => {
        await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
        await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
        await writeFile(join(projectDir, 'skills-lock.json'), '{}\n');
      },
    }),
    /modified protected runner files: \.agents\/skills\/test-skill\/SKILL\.md/,
  );
});

async function writeScenarioDefinition(scenarioDir, turns) {
  await writeFile(
    join(scenarioDir, 'scenario.json'),
    `${JSON.stringify({ turns }, null, 2)}\n`,
  );
}

async function writeProjectPackage(projectDir) {
  await writeFile(join(projectDir, 'package.json'), `${JSON.stringify({
    dependencies: {
      'test-skill-package': '0.0.0',
    },
  }, null, 2)}\n`);
}
