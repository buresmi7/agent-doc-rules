import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { createCodexSession, judgeAgentOutput } from './agent-runtime.mjs';
import {
  formatScenarioCriteria,
  formatTranscript,
  readAgentScenarioDefinition,
} from './agent-scenario-definition.mjs';
import { defaultJudgePromptTemplate } from './defaults.mjs';
import {
  assertProjectPathsUnchanged,
  captureProjectState,
  diffProjectStates,
  formatConversationTurns,
  formatFileChanges,
  prepareProjectFixture,
  readProjectFiles,
} from './project-files.mjs';
import { judgeSchema, render } from './prompts.mjs';
import {
  installProjectDependencies,
  readProjectSkillDefinition,
} from './project-package.mjs';
import { installSkill } from './skill.mjs';
import { writeSnapshotTurns } from './snapshots.mjs';

export async function runAgentScenario({
  scenarioName,
  scenarioDir,
  projectFixtureDir,
  repoRoot,
  runtime,
  skill: skillSelection,
  skillsCliVersion = '1.5.12',
  judgePromptTemplate = defaultJudgePromptTemplate,
  agentMetadata = null,
  snapshotDirName = 'snapshot',
  updateSnapshots = false,
  keepOutput = false,
  passThreshold = 0.8,
  tempPrefix = 'agent-e2e',
  inspectLinks = {},
  projectFileOptions = {},
  env = process.env,
  onProgress = () => {},
  createAgentSession = createCodexSession,
  judge = judgeAgentOutput,
  installProject = installProjectDependencies,
  installProjectSkill = installSkill,
}) {
  const skill = await readProjectSkillDefinition(projectFixtureDir, skillSelection);
  const installedSkillPrefix = skill.installedSkillPath
    ? skill.installedSkillPath.replace(/\/?SKILL\.md$/, '/')
    : `.agents/skills/${skill.name}/`;
  const ignoredProjectPaths = [
    'skills-lock.json',
    ...(projectFileOptions.ignoredPaths ?? []),
  ];
  const ignoredProjectPathPrefixes = [
    installedSkillPrefix,
    ...(projectFileOptions.ignoredPathPrefixes ?? []),
  ];
  const evidenceOptions = {
    ...projectFileOptions,
    ignoredPaths: ignoredProjectPaths,
    ignoredPathPrefixes: ignoredProjectPathPrefixes,
  };
  const stateOptions = {
    ignoredPaths: ignoredProjectPaths,
    ignoredPathPrefixes: ignoredProjectPathPrefixes,
    ignoredDirectoryNames: projectFileOptions.ignoredDirectoryNames,
  };
  const scenarioDefinition = await readAgentScenarioDefinition(scenarioDir);
  const scenarioTurns = scenarioDefinition.turns;
  const tempDir = await mkdtemp(join(tmpdir(), `${tempPrefix}-${scenarioName}-`));
  const projectDir = join(tempDir, 'project');
  let agentSession = null;

  try {
    await cp(projectFixtureDir, projectDir, {
      recursive: true,
      filter: (source) => basename(source) !== 'node_modules',
    });
    const { skillSource } = await installProject({
      projectDir,
      projectFixtureDir,
      repoRoot,
      skill,
      baseEnv: env,
    });
    await prepareProjectFixture(projectDir, {
      hiddenPackageScripts: projectFileOptions.hiddenPackageScripts,
    });
    const originalSkillsLock = await readOptionalFile(join(projectDir, 'skills-lock.json'));

    await installProjectSkill({
      projectDir,
      skillSource,
      skillName: skill.name,
      skillsCliVersion,
      installedSkillPath: skill.installedSkillPath,
      keepOutput,
      baseEnv: env,
    });
    await restoreFixtureFile(
      join(projectDir, 'skills-lock.json'),
      originalSkillsLock,
    );

    const protectedState = await captureProjectState(projectDir);
    const initialProjectState = await captureProjectState(projectDir, stateOptions);
    const projectFilesBefore = await readProjectFiles(projectDir, evidenceOptions);
    const conversationTurns = [];
    agentSession = await createAgentSession(runtime, {
      cwd: projectDir,
      outputDir: join(tempDir, 'agent-session'),
      baseEnv: env,
    });

    for (const [index, scenarioTurn] of scenarioTurns.entries()) {
      onProgress({
        type: 'turn:start',
        id: scenarioTurn.id,
        index: index + 1,
        total: scenarioTurns.length,
        source: scenarioTurn.source,
      });

      const stateBeforeTurn = await captureProjectState(projectDir, stateOptions);
      const turnResult = await agentSession.runTurn(scenarioTurn.prompt);
      const completeStateAfterTurn = await captureProjectState(projectDir);

      assertProjectPathsUnchanged(protectedState, completeStateAfterTurn, {
        paths: ['skills-lock.json'],
        pathPrefixes: [installedSkillPrefix],
      });

      const stateAfterTurn = await captureProjectState(projectDir, stateOptions);

      conversationTurns.push({
        ...scenarioTurn,
        activity: normalizeAgentActivity(turnResult.activity ?? [], projectDir, tempDir),
        changes: diffProjectStates(stateBeforeTurn, stateAfterTurn),
        response: normalizeAgentResponse(turnResult.response, projectDir, tempDir),
      });

      onProgress({
        type: 'turn:complete',
        id: scenarioTurn.id,
        index: index + 1,
        total: scenarioTurns.length,
        source: scenarioTurn.source,
      });
    }

    const finalProjectState = await captureProjectState(projectDir, stateOptions);
    const changes = diffProjectStates(initialProjectState, finalProjectState);
    const transcript = formatTranscript(conversationTurns);
    const criteria = formatScenarioCriteria(scenarioTurns);
    const projectFilesAfter = await readProjectFiles(projectDir, evidenceOptions);
    const judgePrompt = render(judgePromptTemplate, {
      criteria,
      originalProjectFiles: projectFilesBefore,
      projectFiles: projectFilesAfter,
      changes: formatFileChanges(changes),
      transcript: formatConversationTurns(conversationTurns),
    });

    onProgress({ type: 'judge:start' });

    const judgment = await judge(runtime, {
      role: `${scenarioName}-judge`,
      prompt: judgePrompt,
      schema: judgeSchema,
      cwd: projectDir,
      outputDir: join(tempDir, 'judge'),
      baseEnv: env,
    });
    const pass = Boolean(judgment.pass) && Number(judgment.score) >= passThreshold;
    const failureSummaryPath = join(tempDir, 'failure-summary.json');

    if (pass && updateSnapshots) {
      await writeScenarioSnapshot({
        scenarioDir,
        snapshotDirName,
        scenarioName,
        runner: runtime.runner,
        agentMetadata,
        skillsCliVersion,
        skill,
        changes,
        conversationTurns,
        judgment,
        transcript,
      });
    }

    if (!pass) {
      await writeFailureSummary({
        tempDir,
        projectDir,
        scenarioDir,
        repoRoot,
        scenarioName,
        runner: runtime.runner,
        inspectLinks,
        scenarioSource: scenarioDefinition.source,
        changes,
        conversationTurns,
        judgment,
        transcript,
      });
    }

    if (pass && !keepOutput) {
      await rm(tempDir, { recursive: true, force: true });
    }

    return {
      scenario: scenarioName,
      ...judgment,
      pass,
      changedFilePaths: changes.map((file) => file.path),
      transcript,
      outputDir: pass && !keepOutput ? undefined : tempDir,
      failureSummaryPath: pass ? undefined : failureSummaryPath,
    };
  } catch (error) {
    error.message = `${error.message}\nAgent E2E output directory: ${tempDir}`;
    throw error;
  } finally {
    await agentSession?.close?.();
  }
}

async function writeScenarioSnapshot({
  scenarioDir,
  snapshotDirName,
  scenarioName,
  runner,
  agentMetadata,
  skillsCliVersion,
  skill,
  changes,
  conversationTurns,
  judgment,
  transcript,
}) {
  const snapshotDir = join(scenarioDir, snapshotDirName);

  await mkdir(snapshotDir, { recursive: true });
  await rm(join(snapshotDir, 'files'), { recursive: true, force: true });
  await rm(join(snapshotDir, 'generated-files.json'), { force: true });
  await writeFile(
    join(snapshotDir, 'changes.json'),
    `${JSON.stringify(changes, null, 2)}\n`,
  );
  await writeSnapshotTurns(snapshotDir, conversationTurns);
  await writeFile(
    join(snapshotDir, 'metadata.json'),
    `${JSON.stringify({
      scenario: scenarioName,
      runner,
      agent: agentMetadata,
      skillsCliVersion,
      skillPackage: {
        name: skill.packageName,
        source: skill.packageSpec,
        skill: skill.name,
      },
    }, null, 2)}\n`,
  );
  await writeFile(
    join(snapshotDir, 'judgment.json'),
    `${JSON.stringify({
      scenario: scenarioName,
      runner,
      pass: Boolean(judgment.pass),
      score: Number(judgment.score),
      failedCriteria: judgment.failedCriteria,
      requiredFixes: judgment.requiredFixes,
      transcript,
      judgeNotes: judgment.notes,
    }, null, 2)}\n`,
  );
}

async function writeFailureSummary({
  tempDir,
  projectDir,
  scenarioDir,
  repoRoot,
  scenarioName,
  runner,
  inspectLinks,
  scenarioSource,
  changes,
  conversationTurns,
  judgment,
  transcript,
}) {
  const summary = {
    scenario: scenarioName,
    runner,
    pass: false,
    score: judgment.score ?? null,
    failedCriteria: judgment.failedCriteria ?? [],
    requiredFixes: judgment.requiredFixes ?? [],
    transcript,
    judgeNotes: judgment.notes ?? '',
    turns: conversationTurns.map((turn) => ({
      id: turn.id,
      source: turn.source,
      changes: turn.changes.map((file) => ({
        path: file.path,
        status: file.status,
      })),
      activity: turn.activity,
      response: turn.response,
    })),
    changes: changes.map((file) => ({
      path: file.path,
      status: file.status,
      projectPath: join('project', file.path).replaceAll('\\', '/'),
      lineCount: typeof file.content === 'string' && file.encoding !== 'base64'
        ? file.content.trimEnd().split('\n').length
        : null,
    })),
    inspect: {
      outputDir: tempDir,
      projectDir: relative(tempDir, projectDir),
      scenario: repoRoot
        ? relative(repoRoot, join(scenarioDir, scenarioSource))
        : join(scenarioDir, scenarioSource),
      ...inspectLinks,
    },
  };

  await writeFile(join(tempDir, 'failure-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

export function readSnapshotDirName(env = process.env) {
  const value = env.AGENT_E2E_SNAPSHOT_DIR ?? 'snapshot';

  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`AGENT_E2E_SNAPSHOT_DIR must be a directory name, got ${JSON.stringify(value)}`);
  }

  return value;
}

function normalizeAgentResponse(response, projectDir, tempDir) {
  return normalizeRunnerPaths(response, projectDir, tempDir);
}

function normalizeAgentActivity(activity, projectDir, tempDir) {
  return activity.map((item) => {
    if (item.type === 'command_execution') {
      return {
        ...item,
        commandSummary: normalizeRunnerPaths(item.commandSummary, projectDir, tempDir),
      };
    }

    if (item.type === 'file_change') {
      return {
        ...item,
        changes: item.changes.map((change) => ({
          ...change,
          path: normalizeActivityPath(change.path, projectDir, tempDir),
        })),
      };
    }

    return item;
  });
}

function normalizeActivityPath(path, projectDir, tempDir) {
  const normalizedPath = path.replaceAll('\\', '/');
  const normalizedProjectDir = projectDir.replaceAll('\\', '/');

  if (normalizedPath.startsWith(`${normalizedProjectDir}/`)) {
    return normalizedPath.slice(normalizedProjectDir.length + 1);
  }

  return normalizeRunnerPaths(path, projectDir, tempDir);
}

function normalizeRunnerPaths(value, projectDir, tempDir) {
  return value
    .replaceAll(projectDir, '<project>')
    .replaceAll(projectDir.replaceAll('\\', '/'), '<project>')
    .replaceAll(tempDir, '<test-output>')
    .replaceAll(tempDir.replaceAll('\\', '/'), '<test-output>');
}

async function readOptionalFile(path) {
  return readFile(path).catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });
}

async function restoreFixtureFile(path, content) {
  if (content === null) {
    await rm(path, { force: true });
    return;
  }

  await writeFile(path, content);
}
