import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { writeFailureArtifacts } from '@buresmi7/agent-e2e-report';
import { createCodexSession, judgeAgentOutput } from './agent-runtime.mjs';
import {
  formatScenarioCriteria,
  formatTranscript,
  readAgentScenarioDefinition,
} from './agent-scenario-definition.mjs';
import { defaultJudgePromptTemplate } from './defaults.mjs';
import {
  createScenarioOutputDirectory,
  removeScenarioOutputDirectory,
} from './output-directory.mjs';
import {
  assertProjectPathsUnchanged,
  captureProjectState,
  diffProjectStates,
  diffProjectStatesForReport,
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
  outputRoot,
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
  const reportOptions = {
    maxFileBytes: projectFileOptions.maxReportFileBytes,
  };
  const scenarioDefinition = await readAgentScenarioDefinition(scenarioDir);
  const scenarioTurns = scenarioDefinition.turns;
  const { outputDir } = await createScenarioOutputDirectory({
    scenarioDir,
    outputRoot,
    projectFixtureDir,
    prefix: `${tempPrefix}-${scenarioName}`,
  });
  const projectDir = join(outputDir, 'project');
  const conversationTurns = [];
  let agentSession = null;
  let initialProjectState = null;
  let activeTurn = null;
  let activeTurnState = null;
  let activeTurnResult = null;
  let stage = 'fixture-copy';

  try {
    await cp(projectFixtureDir, projectDir, {
      recursive: true,
      filter: (source) => basename(source) !== 'node_modules',
    });

    stage = 'project-install';
    const { skillSource } = await installProject({
      projectDir,
      projectFixtureDir,
      repoRoot,
      skill,
      baseEnv: env,
    });

    stage = 'fixture-prepare';
    await prepareProjectFixture(projectDir, {
      hiddenPackageScripts: projectFileOptions.hiddenPackageScripts,
    });
    const originalSkillsLock = await readOptionalFile(join(projectDir, 'skills-lock.json'));

    stage = 'skill-install';
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
    initialProjectState = await captureProjectState(projectDir, stateOptions);
    const projectFilesBefore = await readProjectFiles(projectDir, evidenceOptions);

    stage = 'agent-session';
    agentSession = await createAgentSession(runtime, {
      cwd: projectDir,
      outputDir: join(outputDir, 'agent-session'),
      baseEnv: env,
    });

    for (const [index, scenarioTurn] of scenarioTurns.entries()) {
      stage = `turn:${scenarioTurn.id}`;
      activeTurn = scenarioTurn;
      activeTurnResult = null;

      onProgress({
        type: 'turn:start',
        id: scenarioTurn.id,
        index: index + 1,
        total: scenarioTurns.length,
        source: scenarioTurn.source,
      });

      activeTurnState = await captureProjectState(projectDir, stateOptions);
      activeTurnResult = await agentSession.runTurn(scenarioTurn.prompt);
      const completeStateAfterTurn = await captureProjectState(projectDir);

      assertProjectPathsUnchanged(protectedState, completeStateAfterTurn, {
        paths: ['skills-lock.json'],
        pathPrefixes: [installedSkillPrefix],
      });

      const stateAfterTurn = await captureProjectState(projectDir, stateOptions);

      conversationTurns.push({
        ...scenarioTurn,
        activity: normalizeAgentActivity(
          activeTurnResult.activity ?? [],
          projectDir,
          outputDir,
        ),
        changes: diffProjectStates(activeTurnState, stateAfterTurn),
        reportChanges: diffProjectStatesForReport(
          activeTurnState,
          stateAfterTurn,
          reportOptions,
        ),
        response: normalizeAgentResponse(
          activeTurnResult.response,
          projectDir,
          outputDir,
        ),
      });
      activeTurn = null;
      activeTurnState = null;
      activeTurnResult = null;

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
    const reportChanges = diffProjectStatesForReport(
      initialProjectState,
      finalProjectState,
      reportOptions,
    );
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

    stage = 'judge';
    onProgress({ type: 'judge:start' });

    const judgment = await judge(runtime, {
      role: `${scenarioName}-judge`,
      prompt: judgePrompt,
      schema: judgeSchema,
      cwd: projectDir,
      outputDir: join(outputDir, 'judge'),
      baseEnv: env,
    });
    const pass = Boolean(judgment.pass) && Number(judgment.score) >= passThreshold;
    let failureArtifacts = {};

    if (pass && updateSnapshots) {
      stage = 'snapshot';
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
      failureArtifacts = await writeFailureArtifacts({
        outputDir,
        projectDir,
        scenarioDir,
        repoRoot,
        scenarioName,
        runner: runtime.runner,
        agentMetadata,
        inspectLinks,
        scenarioSource: scenarioDefinition.source,
        stage: 'judge',
        changes,
        reportChanges,
        conversationTurns,
        judgment,
        transcript,
      });
    }

    if (pass && !keepOutput) {
      stage = 'cleanup';
      await removeScenarioOutputDirectory(outputDir);
    }

    return {
      scenario: scenarioName,
      ...judgment,
      pass,
      changedFilePaths: changes.map((file) => file.path),
      transcript,
      outputDir: pass && !keepOutput ? undefined : outputDir,
      agentSessionPath: pass ? undefined : failureArtifacts.agentSessionPath,
      failureSummaryPath: pass ? undefined : failureArtifacts.failureSummaryPath,
      failureReportPath: pass ? undefined : failureArtifacts.failureReportPath,
      artifactWriteErrors: failureArtifacts.writeErrors ?? [],
    };
  } catch (error) {
    const failureStage = stage;
    let failureArtifacts = { writeErrors: [] };

    try {
      const partial = await capturePartialFailure({
        projectDir,
        outputDir,
        stateOptions,
        reportOptions,
        initialProjectState,
        conversationTurns,
        activeTurn,
        activeTurnState,
        activeTurnResult,
      });

      failureArtifacts = await writeFailureArtifacts({
        outputDir,
        projectDir,
        scenarioDir,
        repoRoot,
        scenarioName,
        runner: runtime.runner,
        agentMetadata,
        inspectLinks,
        scenarioSource: scenarioDefinition.source,
        stage: failureStage,
        changes: partial.changes,
        reportChanges: partial.reportChanges,
        conversationTurns: partial.conversationTurns,
        transcript: partial.transcript,
        error,
      });
    } catch (reportError) {
      failureArtifacts.writeErrors.push(
        `Could not collect failure report data: ${reportError.message}`,
      );
    }

    const details = [
      `Agent E2E output directory: ${outputDir}`,
      failureArtifacts.failureReportPath
        ? `Agent E2E failure report: ${failureArtifacts.failureReportPath}`
        : null,
      failureArtifacts.agentSessionPath
        ? `Agent E2E session data: ${failureArtifacts.agentSessionPath}`
        : null,
      failureArtifacts.failureSummaryPath
        ? `Agent E2E failure summary: ${failureArtifacts.failureSummaryPath}`
        : null,
      ...failureArtifacts.writeErrors.map((message) => `Agent E2E artifact warning: ${message}`),
    ].filter(Boolean);

    error.message = `${error.message}\n${details.join('\n')}`;
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

async function capturePartialFailure({
  projectDir,
  outputDir,
  stateOptions,
  reportOptions,
  initialProjectState,
  conversationTurns,
  activeTurn,
  activeTurnState,
  activeTurnResult,
}) {
  const currentState = await captureProjectState(projectDir, stateOptions)
    .catch(() => null);
  const partialTurns = [...conversationTurns];

  if (activeTurn) {
    const turnChanges = activeTurnState && currentState
      ? diffProjectStates(activeTurnState, currentState)
      : [];
    const turnReportChanges = activeTurnState && currentState
      ? diffProjectStatesForReport(activeTurnState, currentState, reportOptions)
      : [];

    partialTurns.push({
      ...activeTurn,
      incomplete: true,
      activity: normalizeAgentActivity(
        activeTurnResult?.activity ?? [],
        projectDir,
        outputDir,
      ),
      changes: turnChanges,
      reportChanges: turnReportChanges,
      response: activeTurnResult?.response
        ? normalizeAgentResponse(activeTurnResult.response, projectDir, outputDir)
        : '',
    });
  }

  const changes = initialProjectState && currentState
    ? diffProjectStates(initialProjectState, currentState)
    : [];
  const reportChanges = initialProjectState && currentState
    ? diffProjectStatesForReport(initialProjectState, currentState, reportOptions)
    : [];

  return {
    changes,
    reportChanges,
    conversationTurns: partialTurns,
    transcript: partialTurns.length > 0 ? formatTranscript(partialTurns) : '',
  };
}

export function readSnapshotDirName(env = process.env) {
  const value = env.AGENT_E2E_SNAPSHOT_DIR ?? 'snapshot';

  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`AGENT_E2E_SNAPSHOT_DIR must be a directory name, got ${JSON.stringify(value)}`);
  }

  return value;
}

function normalizeAgentResponse(response, projectDir, outputDir) {
  return normalizeRunnerPaths(response, projectDir, outputDir);
}

function normalizeAgentActivity(activity, projectDir, outputDir) {
  return activity.map((item) => {
    if (item.type === 'command_execution') {
      return {
        ...item,
        commandSummary: normalizeRunnerPaths(item.commandSummary, projectDir, outputDir),
      };
    }

    if (item.type === 'file_change') {
      return {
        ...item,
        changes: item.changes.map((change) => ({
          ...change,
          path: normalizeActivityPath(change.path, projectDir, outputDir),
        })),
      };
    }

    return item;
  });
}

function normalizeActivityPath(path, projectDir, outputDir) {
  const normalizedPath = path.replaceAll('\\', '/');
  const normalizedProjectDir = projectDir.replaceAll('\\', '/');

  if (normalizedPath.startsWith(`${normalizedProjectDir}/`)) {
    return normalizedPath.slice(normalizedProjectDir.length + 1);
  }

  return normalizeRunnerPaths(path, projectDir, outputDir);
}

function normalizeRunnerPaths(value, projectDir, outputDir) {
  return value
    .replaceAll(projectDir, '<project>')
    .replaceAll(projectDir.replaceAll('\\', '/'), '<project>')
    .replaceAll(outputDir, '<test-output>')
    .replaceAll(outputDir.replaceAll('\\', '/'), '<test-output>');
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
