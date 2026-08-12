import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
    createAgentSession: async (_runtime, { cwd, outputDir: sessionOutputDir }) => ({
      async runTurn(prompt) {
        calls.push(prompt);
        const liveReport = JSON.parse(await readFile(
          join(dirname(sessionOutputDir), 'report.json'),
          'utf8',
        ));

        if (calls.length === 1) {
          assert.equal(liveReport.stage, 'turn:request');
          assert.deepEqual(
            liveReport.turns.map((turn) => turn.status),
            ['running', 'pending'],
          );
          assert.deepEqual(
            liveReport.turns.map((turn) => turn.response),
            [null, null],
          );
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

        assert.equal(liveReport.stage, 'turn:confirm');
        assert.deepEqual(
          liveReport.turns.map((turn) => turn.status),
          ['completed', 'running'],
        );
        assert.equal(liveReport.turns[0].response, 'Should I replace the title?');
        await writeFile(join(cwd, 'README.md'), '# Updated\n');
        return { response: `Updated [README](${cwd}/README.md:1).` };
      },
    }),
    judge: async (_runtime, request) => {
      const liveReport = JSON.parse(await readFile(
        join(dirname(request.outputDir), 'report.json'),
        'utf8',
      ));

      assert.equal(liveReport.stage, 'judge');
      assert.deepEqual(
        liveReport.turns.map((turn) => turn.status),
        ['completed', 'completed'],
      );
      assert.equal(liveReport.turns[1].response, 'Updated [README](<project>/README.md:1).');
      assert.equal(liveReport.turns[1].changes[0].path, 'README.md');
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
    dirname(result.outputDir),
    join(scenarioDir, '.agent-e2e-output'),
  );
  assert.match(result.outputDir, /agent-e2e-example-/);
  assert.equal(
    await readFile(join(result.outputDir, 'project/README.md'), 'utf8'),
    '# Updated\n',
  );
  assert.doesNotMatch(
    await readFile(join(result.outputDir, 'project/package.json'), 'utf8'),
    /test:agent/,
  );
  const snapshot = JSON.parse(
    await readFile(join(scenarioDir, 'snapshot/report.json'), 'utf8'),
  );
  const runReport = JSON.parse(await readFile(result.reportPath, 'utf8'));

  assert.deepEqual(snapshot.skillPackage, {
    name: 'test-skill-package',
    source: '0.0.0',
    skill: 'test-skill',
  });
  assert.equal(snapshot.status, 'passed');
  assert.equal(snapshot.revision, 1);
  assert.deepEqual(snapshot.inspect, {});
  assert.deepEqual(snapshot.turns.map((turn) => turn.status), ['completed', 'completed']);
  assert.equal(snapshot.turns[0].response, 'Should I replace the title?');
  assert.equal(snapshot.turns[1].criteria[0].status, 'passed');
  assert.deepEqual(
    snapshot.turns[1].changes[0].patch.lines.slice(0, 4),
    [
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1 +1 @@',
      '-# Fixture',
    ],
  );
  assert.equal(runReport.status, 'passed');
  assert.equal(runReport.inspect.project, 'project');
  assert.equal(runReport.changes[0].path, 'README.md');
  assert.match(runReport.changes[0].patch.lines.join('\n'), /# Updated/);
  assert.equal(snapshot.changes[0].path, 'README.md');
  await assert.rejects(
    () => access(join(result.outputDir, 'project/skills-lock.json')),
    /ENOENT/,
  );
});

test('runAgentScenario removes a normal passing run after writing its checkpoints', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-cleanup-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');
  let observedOutputDir;

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeScenarioDefinition(scenarioDir, [{
    id: 'inspect',
    prompt: 'Inspect the project.',
    criteria: { accurate: 'Describe the project.' },
  }]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  const result = await runAgentScenario({
    scenarioName: 'passing-cleanup',
    scenarioDir,
    projectFixtureDir,
    repoRoot: root,
    runtime: { runner: 'codex' },
    skill: selectedSkill,
    judgePromptTemplate: '{{criteria}}',
    createAgentSession: async (_runtime, { outputDir }) => {
      observedOutputDir = dirname(outputDir);
      return {
        async runTurn() {
          await access(join(observedOutputDir, 'report.json'));
          return { response: 'The project contains README.md.' };
        },
      };
    },
    judge: async () => ({
      pass: true,
      score: 1,
      failedCriteria: [],
      requiredFixes: [],
      notes: '',
    }),
    installProject: async () => ({ skillSource }),
    installProjectSkill: async ({ projectDir, installedSkillPath }) => {
      await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
      await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
    },
  });

  assert.equal(result.pass, true);
  assert.equal(result.outputDir, undefined);
  assert.equal(result.reportPath, undefined);
  await assert.rejects(() => access(observedOutputDir), /ENOENT/);
  assert.deepEqual(
    await readdir(join(scenarioDir, '.agent-e2e-output')),
    ['.gitignore'],
  );
});

test('runAgentScenario restores a fixture lock and retains turn ids on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-lock-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');
  const fixtureLock = '{"fixture":true}\n';
  const cleanupError = `Could not remove failed-run credentials. ${'x'.repeat(70 * 1024)}`;

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
    createAgentSession: async (_runtime, { cwd }) => ({
      async runTurn() {
        assert.equal(await readFile(join(cwd, 'skills-lock.json'), 'utf8'), fixtureLock);
        return { response: 'The fixture is unchanged.' };
      },
      async close() {
        throw new Error(cleanupError);
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
  const report = JSON.parse(await readFile(result.reportPath, 'utf8'));

  assert.equal(result.pass, false);
  assert.equal(result.artifactWriteErrors.length, 1);
  assert.match(
    result.artifactWriteErrors[0],
    /^Could not close the agent session: Could not remove failed-run credentials\./,
  );
  assert.match(result.artifactWriteErrors[0], /\.\.\. \[truncated\]$/);
  assert.ok(Buffer.byteLength(result.artifactWriteErrors[0], 'utf8') <= 64 * 1024);
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.warnings, result.artifactWriteErrors);
  assert.equal(report.turns[0].response, 'The fixture is unchanged.');
  assert.equal(report.turns[0].criteria[0].status, 'failed');
  assert.deepEqual(report.turns.map(({ id, source }) => ({ id, source })), [{
    id: 'inspect',
    source: 'scenario.json#/turns/0',
  }]);
});

test('runAgentScenario preserves prior turns when a later turn errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-runtime-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeScenarioDefinition(scenarioDir, [
    {
      id: 'inspect',
      prompt: 'Inspect the project.',
      criteria: { accurate: 'Describe the project.' },
    },
    {
      id: 'update',
      prompt: 'Update the project.',
      criteria: { updated: 'Update the project.' },
    },
    {
      id: 'change',
      prompt: 'Change the project again.',
      criteria: { 'change-project': 'Change the project again.' },
    },
    {
      id: 'verify',
      prompt: 'Verify the final project.',
      criteria: { 'verify-project': 'Verify the final project.' },
    },
  ]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  let caught;

  try {
    await runAgentScenario({
      scenarioName: 'runtime-error',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      judgePromptTemplate: '{{criteria}}',
      createAgentSession: async (_runtime, { cwd }) => {
        let turn = 0;

        return {
          async runTurn() {
            turn += 1;

            if (turn === 1) {
              return { response: 'The project contains README.md.' };
            }

            if (turn === 2) {
              await writeFile(join(cwd, 'README.md'), '# Step two\n');
              return { response: 'Updated README.md.' };
            }

            await writeFile(join(cwd, 'README.md'), '# Partially changed\n');
            throw new Error('Codex stopped during the turn.');
          },
          async close() {
            throw new Error('Session cleanup also failed.');
          },
        };
      },
      installProject: async () => ({ skillSource }),
      installProjectSkill: async ({ projectDir, installedSkillPath }) => {
        await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
        await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught);
  assert.match(caught.message, /Codex stopped during the turn\./);
  assert.deepEqual(caught.artifactWriteErrors, [
    'Could not close the agent session: Session cleanup also failed.',
  ]);
  assert.ok(caught.reportPath);

  const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'turn:change');
  assert.deepEqual(report.warnings, [
    'Could not close the agent session: Session cleanup also failed.',
  ]);
  assert.deepEqual(report.turns.map((turn) => turn.status), [
    'completed',
    'completed',
    'incomplete',
    'pending',
  ]);
  assert.equal(report.turns[0].response, 'The project contains README.md.');
  assert.equal(report.turns[1].response, 'Updated README.md.');
  assert.equal(report.turns[1].changes[0].path, 'README.md');
  assert.equal(report.turns[2].prompt, 'Change the project again.');
  assert.equal(report.turns[2].criteria[0].content, 'Change the project again.');
  assert.equal(report.turns[2].changes[0].path, 'README.md');
  assert.match(report.turns[2].changes[0].patch.lines.join('\n'), /Partially changed/);
  assert.equal(report.changes[0].path, 'README.md');
  assert.match(report.changes[0].patch.lines.join('\n'), /Partially changed/);
  assert.equal(report.turns[3].prompt, 'Verify the final project.');
  assert.equal(report.turns[3].criteria[0].content, 'Verify the final project.');
  assert.equal(report.turns[3].response, null);
});

test('runAgentScenario bounds turn results and keeps the incomplete-turn diff', async (t) => {
  const variants = [
    {
      name: 'response',
      expectedError: /Agent response exceeds the 524288-byte report limit/,
      result: { response: 'x'.repeat(512 * 1024) },
    },
    {
      name: 'activity',
      expectedError: /Agent activity exceeds the 524288-byte report limit/,
      result: {
        response: 'Changed README.md.',
        activity: [{
          type: 'command_execution',
          commandSummary: 'x'.repeat(512 * 1024),
          exitCode: 0,
          status: 'completed',
        }],
      },
    },
  ];

  for (const variant of variants) {
    await t.test(variant.name, async () => {
      const root = await mkdtemp(join(
        tmpdir(),
        `agent-e2e-agent-${variant.name}-limit-`,
      ));
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
        criteria: { changed: 'README.md is changed.' },
      }]);
      await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

      let caught;

      try {
        await runAgentScenario({
          scenarioName: `${variant.name}-limit`,
          scenarioDir,
          projectFixtureDir,
          repoRoot: root,
          runtime: { runner: 'codex' },
          skill: selectedSkill,
          createAgentSession: async (_runtime, { cwd }) => ({
            async runTurn() {
              await writeFile(join(cwd, 'README.md'), '# Changed\n');
              return variant.result;
            },
          }),
          installProject: async () => ({ skillSource }),
          installProjectSkill: installTestSkill,
        });
      } catch (error) {
        caught = error;
      }

      assert.match(caught?.message, variant.expectedError);

      const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

      assert.equal(report.status, 'error');
      assert.equal(report.stage, 'turn:change');
      assert.equal(report.turns[0].status, 'incomplete');
      assert.equal(report.turns[0].changes[0].path, 'README.md');
      assert.match(report.turns[0].changes[0].patch.lines.join('\n'), /# Changed/);
      assert.equal(report.changes[0].path, 'README.md');
      assert.match(report.changes[0].patch.lines.join('\n'), /# Changed/);
    });
  }
});

test('runAgentScenario rejects oversized and ambiguous judge results', async (t) => {
  const variants = [
    {
      name: 'oversized',
      expectedError: /Judge result exceeds the 2097152-byte report limit/,
      judgment: {
        pass: true,
        score: 1,
        failedCriteria: [],
        requiredFixes: [],
        notes: 'x'.repeat(2 * 1024 * 1024),
      },
    },
    {
      name: 'duplicate-failure',
      expectedError: /Judge result failedCriteria must contain unique ids/,
      judgment: {
        pass: false,
        score: 0,
        failedCriteria: [
          { id: 'change.changed', reason: 'One.' },
          { id: 'change.changed', reason: 'Two.' },
        ],
        requiredFixes: [],
        notes: '',
      },
    },
  ];

  for (const variant of variants) {
    await t.test(variant.name, async () => {
      const root = await mkdtemp(join(
        tmpdir(),
        `agent-e2e-agent-judge-${variant.name}-`,
      ));
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
        criteria: { changed: 'README.md is changed.' },
      }]);
      await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

      let caught;

      try {
        await runAgentScenario({
          scenarioName: `judge-${variant.name}`,
          scenarioDir,
          projectFixtureDir,
          repoRoot: root,
          runtime: { runner: 'codex' },
          skill: selectedSkill,
          createAgentSession: async (_runtime, { cwd }) => ({
            async runTurn() {
              await writeFile(join(cwd, 'README.md'), '# Changed\n');
              return { response: 'Changed README.md.' };
            },
          }),
          judge: async () => variant.judgment,
          installProject: async () => ({ skillSource }),
          installProjectSkill: installTestSkill,
        });
      } catch (error) {
        caught = error;
      }

      assert.match(caught?.message, variant.expectedError);

      const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

      assert.equal(report.status, 'error');
      assert.equal(report.stage, 'judge');
      assert.equal(report.turns[0].status, 'completed');
      assert.equal(report.evaluation, null);
      assert.equal(report.changes[0].path, 'README.md');
    });
  }
});

test('runAgentScenario recovers from a turn checkpoint contract failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-checkpoint-recovery-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');
  let turn = 0;

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeScenarioDefinition(scenarioDir, [
    {
      id: 'inspect',
      prompt: 'Inspect the project.',
      criteria: { inspected: 'The project is inspected.' },
    },
    {
      id: 'verify',
      prompt: 'Verify the project.',
      criteria: { verified: 'The project is verified.' },
    },
  ]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  let caught;

  try {
    await runAgentScenario({
      scenarioName: 'checkpoint-recovery',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      createAgentSession: async () => ({
        async runTurn() {
          turn += 1;

          if (turn === 1) {
            return { response: 'README.md exists.' };
          }

          return {
            response: 'Verified.',
            activity: [{
              type: 'file_change',
              status: 'completed',
              changes: [{
                path: 'https://example.test/not-a-project-path',
                kind: 'modified',
              }],
            }],
          };
        },
      }),
      installProject: async () => ({ skillSource }),
      installProjectSkill: installTestSkill,
    });
  } catch (error) {
    caught = error;
  }

  assert.match(
    caught?.message,
    /activity\[0\]\.changes\[0\]\.path must be a relative path/,
  );

  const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'turn:verify');
  assert.deepEqual(
    report.turns.map((item) => item.status),
    ['completed', 'incomplete'],
  );
  assert.equal(report.turns[0].response, 'README.md exists.');
  assert.equal(report.turns[1].response, null);
  assert.match(report.turns[1].error.message, /must be a relative path/);
  assert.ok(report.warnings.some(
    (warning) => /Could not write report\.json revision/.test(warning),
  ));
});

test('runAgentScenario keeps passed criteria when the score is below threshold', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-threshold-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeScenarioDefinition(scenarioDir, [{
    id: 'inspect',
    prompt: 'Inspect the project.',
    criteria: { accurate: 'Describe the project accurately.' },
  }]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  const result = await runAgentScenario({
    scenarioName: 'threshold',
    scenarioDir,
    projectFixtureDir,
    repoRoot: root,
    runtime: { runner: 'codex' },
    skill: selectedSkill,
    judgePromptTemplate: '{{criteria}}',
    keepOutput: true,
    passThreshold: 0.8,
    createAgentSession: async () => ({
      async runTurn() {
        return { response: 'The fixture contains a README.' };
      },
    }),
    judge: async () => ({
      pass: true,
      score: 0.7,
      failedCriteria: [],
      requiredFixes: [],
      notes: 'Below the configured threshold.',
    }),
    installProject: async () => ({ skillSource }),
    installProjectSkill: async ({ projectDir, installedSkillPath }) => {
      await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
      await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
    },
  });

  const report = JSON.parse(await readFile(result.reportPath, 'utf8'));

  assert.equal(result.pass, false);
  assert.equal(report.evaluation.outcomeReason, 'score-below-threshold');
  assert.equal(report.turns[0].criteria[0].status, 'passed');
});

test('runAgentScenario writes report.json for scenario setup errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-setup-report-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');

  await mkdir(projectFixtureDir, { recursive: true });
  await writeFile(join(scenarioDir, 'scenario.json'), '{');

  let caught;

  try {
    await runAgentScenario({
      scenarioName: 'setup-error',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught?.reportPath);

  const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'scenario-definition');
  assert.deepEqual(report.turns, []);
  assert.match(report.error.message, /Invalid JSON in scenario\.json/);
});

test('runAgentScenario records declared turns before runtime preparation fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-runtime-setup-report-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  let installCalls = 0;

  await mkdir(projectFixtureDir, { recursive: true });
  await writeScenarioDefinition(scenarioDir, [{
    id: 'inspect',
    prompt: 'Inspect the project.',
    criteria: { accurate: 'Describe the project.' },
  }]);

  let caught;

  try {
    await runAgentScenario({
      scenarioName: 'runtime-setup-error',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      prepareAgentRuntime: async () => {
        throw new Error('Codex runtime is unavailable.');
      },
      installProject: async () => {
        installCalls += 1;
        return {};
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.match(caught?.message, /Codex runtime is unavailable/);
  assert.equal(installCalls, 0);

  const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'agent-runtime');
  assert.equal(report.turns[0].status, 'pending');
  assert.equal(report.turns[0].prompt, 'Inspect the project.');
  assert.equal(report.turns[0].criteria[0].content, 'Describe the project.');
});

test('runAgentScenario validates report limits before setup or an agent call', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-config-report-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  let setupCalls = 0;

  await mkdir(projectFixtureDir, { recursive: true });

  let caught;

  try {
    await runAgentScenario({
      scenarioName: 'invalid-report-limit',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      projectFileOptions: { maxReportDiffBytes: -1 },
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
      installProject: async () => {
        setupCalls += 1;
        return {};
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.match(caught?.message, /maxReportDiffBytes must be a non-negative integer/);
  assert.equal(setupCalls, 0);

  const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'configuration');

  let evidenceLimitError;

  try {
    await runAgentScenario({
      scenarioName: 'invalid-evidence-limit',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      projectFileOptions: { maxEvidenceBytes: Number.NaN },
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
      installProject: async () => {
        setupCalls += 1;
        return {};
      },
    });
  } catch (error) {
    evidenceLimitError = error;
  }

  assert.match(
    evidenceLimitError?.message,
    /maxEvidenceBytes must be a non-negative integer/,
  );
  assert.equal(setupCalls, 0);
  assert.equal(
    JSON.parse(await readFile(evidenceLimitError.reportPath, 'utf8')).stage,
    'configuration',
  );

  let thresholdError;

  try {
    await runAgentScenario({
      scenarioName: 'invalid-pass-threshold',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      passThreshold: Number.POSITIVE_INFINITY,
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
    });
  } catch (error) {
    thresholdError = error;
  }

  assert.match(
    thresholdError?.message,
    /passThreshold must be a finite number from 0 to 1/,
  );
  assert.equal(setupCalls, 0);

  const thresholdReport = JSON.parse(await readFile(thresholdError.reportPath, 'utf8'));

  assert.equal(thresholdReport.status, 'error');
  assert.equal(thresholdReport.stage, 'configuration');
  assert.equal(thresholdReport.passThreshold, null);

  let rangeError;

  try {
    await runAgentScenario({
      scenarioName: 'out-of-range-pass-threshold',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      passThreshold: 2,
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
    });
  } catch (error) {
    rangeError = error;
  }

  assert.match(
    rangeError?.message,
    /passThreshold must be a finite number from 0 to 1/,
  );
  assert.equal(setupCalls, 0);
  assert.equal(
    JSON.parse(await readFile(rangeError.reportPath, 'utf8')).status,
    'error',
  );

  let inspectError;

  try {
    await runAgentScenario({
      scenarioName: 'reserved-inspect-link',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      inspectLinks: { project: 'somewhere-else' },
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
    });
  } catch (error) {
    inspectError = error;
  }

  assert.match(inspectError?.message, /inspectLinks\.project is reserved/);
  assert.equal(setupCalls, 0);

  const inspectReport = JSON.parse(await readFile(inspectError.reportPath, 'utf8'));

  assert.equal(inspectReport.status, 'error');
  assert.deepEqual(inspectReport.inspect, { project: 'project' });

  let unsafeInspectError;

  try {
    await runAgentScenario({
      scenarioName: 'unsafe-inspect-link',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      inspectLinks: { events: 'https://example.test/events.jsonl' },
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
    });
  } catch (error) {
    unsafeInspectError = error;
  }

  assert.match(unsafeInspectError?.message, /inspectLinks\.events must be repository-relative/);
  assert.equal(setupCalls, 0);
  assert.equal(
    JSON.parse(await readFile(unsafeInspectError.reportPath, 'utf8')).stage,
    'configuration',
  );

  let runtimeError;

  try {
    await runAgentScenario({
      scenarioName: 'missing-runtime',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: null,
      skill: selectedSkill,
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
    });
  } catch (error) {
    runtimeError = error;
  }

  assert.match(runtimeError?.message, /runtime\.runner must be a non-empty string/);
  assert.equal(setupCalls, 0);
  assert.equal(
    JSON.parse(await readFile(runtimeError.reportPath, 'utf8')).status,
    'error',
  );

  let snapshotDirError;

  try {
    await runAgentScenario({
      scenarioName: 'invalid-snapshot-directory',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      snapshotDirName: '../outside',
      createAgentSession: async () => {
        setupCalls += 1;
        return { async runTurn() {} };
      },
    });
  } catch (error) {
    snapshotDirError = error;
  }

  assert.match(snapshotDirError?.message, /snapshotDirName must be a directory name/);
  assert.equal(setupCalls, 0);
  assert.equal(
    JSON.parse(await readFile(snapshotDirError.reportPath, 'utf8')).stage,
    'configuration',
  );
});

test('runAgentScenario records agent session cleanup failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-agent-close-report-'));
  const scenarioDir = join(root, 'scenario');
  const projectFixtureDir = join(scenarioDir, 'project');
  const skillSource = join(root, 'skill-source');

  await mkdir(projectFixtureDir, { recursive: true });
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(projectFixtureDir, 'README.md'), '# Fixture\n');
  await writeProjectPackage(projectFixtureDir);
  await writeScenarioDefinition(scenarioDir, [{
    id: 'inspect',
    prompt: 'Inspect the project.',
    criteria: { accurate: 'Describe the project.' },
  }]);
  await writeFile(join(skillSource, 'SKILL.md'), '# Test Skill\n');

  let caught;

  try {
    await runAgentScenario({
      scenarioName: 'session-close-error',
      scenarioDir,
      projectFixtureDir,
      repoRoot: root,
      runtime: { runner: 'codex' },
      skill: selectedSkill,
      judgePromptTemplate: '{{criteria}}',
      createAgentSession: async () => ({
        async runTurn() {
          return { response: 'The project contains README.md.' };
        },
        async close() {
          throw new Error(
            `Could not remove session credentials. ${'x'.repeat(70 * 1024)}`,
          );
        },
      }),
      judge: async () => ({
        pass: true,
        score: 1,
        failedCriteria: [],
        requiredFixes: [],
        notes: 'The scenario passed.',
      }),
      installProject: async () => ({ skillSource }),
      installProjectSkill: async ({ projectDir, installedSkillPath }) => {
        await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
        await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
      },
    });
  } catch (error) {
    caught = error;
  }

  assert.match(caught?.message, /Could not remove session credentials/);
  const report = JSON.parse(await readFile(caught.reportPath, 'utf8'));

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'session-close');
  assert.equal(report.turns[0].status, 'completed');
  assert.equal(report.turns[0].response, 'The project contains README.md.');
  assert.ok(Buffer.byteLength(report.error.message, 'utf8') <= 64 * 1024);
  assert.match(report.error.message, /\.\.\. \[truncated\]$/);
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

async function installTestSkill({
  projectDir,
  installedSkillPath = '.agents/skills/test-skill/SKILL.md',
}) {
  await mkdir(join(projectDir, '.agents/skills/test-skill'), { recursive: true });
  await writeFile(join(projectDir, installedSkillPath), '# Installed Skill\n');
}
