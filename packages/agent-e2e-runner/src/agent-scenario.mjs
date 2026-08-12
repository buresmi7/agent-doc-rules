import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
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
  applyReportEvaluation,
  createScenarioReport,
  defaultMaxReportDocumentBytes,
  markReportError,
  maxReportWarnings,
  reportErrorRecoveryReserveBytes,
  replaceReportTurns,
  serializeReportError,
  setReportAgentMetadata,
  truncateReportWarning,
  writeReportJsonCheckpoint,
} from './report-document.mjs';
import {
  installProjectDependencies,
  readProjectSkillDefinition,
} from './project-package.mjs';
import { installSkill } from './skill.mjs';
import {
  validateSnapshotDirectoryName,
  writeScenarioSnapshot,
} from './snapshots.mjs';

const defaultReportPatchBytes = 8 * 1024 * 1024;
const maxReportActivityBytes = 512 * 1024;
const maxReportActivityItems = 1024;
const maxReportJudgmentBytes = 2 * 1024 * 1024;
const maxReportResponseBytes = 512 * 1024;

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
  prepareAgentRuntime = async () => agentMetadata,
}) {
  const { outputDir } = await createScenarioOutputDirectory({
    scenarioDir,
    outputRoot,
    projectFixtureDir,
    prefix: `${tempPrefix}-${scenarioName}`,
  });

  runtime = isRecord(runtime) ? runtime : {};
  projectFileOptions = isRecord(projectFileOptions) ? projectFileOptions : {};
  inspectLinks = isRecord(inspectLinks) ? inspectLinks : {};

  const projectDir = join(outputDir, 'project');
  const report = createScenarioReport({
    scenarioName,
    runner: 'unknown',
    passThreshold,
    inspect: { project: 'project' },
  });
  const artifactWriteErrors = [];
  const conversationTurns = [];
  const reportBudget = {
    remainingBytes: defaultReportPatchBytes,
  };
  const reportOptions = {
    maxFileBytes: projectFileOptions.maxReportFileBytes,
    maxDiffBytes: projectFileOptions.maxReportDiffBytes,
    maxChanges: projectFileOptions.maxReportChanges,
    budget: reportBudget,
  };
  let reportPath;
  let snapshotPath;
  let agentSession = null;
  let stage = 'initializing';
  let stateOptions = {};
  let protectedStateOptions = {};
  let initialProjectState = null;
  let activeTurnIndex = null;
  let activeTurnState = null;
  let activeTurnResult = null;
  let finalReportChangesCaptured = false;
  let latestPersistedReport = null;

  const recordArtifactWarning = (message) => {
    addArtifactWarning(artifactWriteErrors, message);
    addArtifactWarning(report.warnings, message);
  };
  const checkpoint = async ({ fatal = true } = {}) => {
    report.revision += 1;

    try {
      const maxBytes = report.status === 'error'
        ? defaultMaxReportDocumentBytes
        : defaultMaxReportDocumentBytes - reportErrorRecoveryReserveBytes;
      const result = await writeReportJsonCheckpoint(outputDir, report, { maxBytes });

      reportPath = result.reportPath;
      latestPersistedReport = result.persistedReport;
      return true;
    } catch (error) {
      recordArtifactWarning(
        `Could not write report.json revision ${report.revision}: ${error.message}`,
      );

      if (fatal) {
        throw error;
      }

      return false;
    }
  };
  const enterStage = async (nextStage) => {
    stage = nextStage;
    report.stage = nextStage;
    await checkpoint();
  };
  const closeAgentSession = async () => {
    const session = agentSession;

    agentSession = null;
    await session?.close?.();
  };
  try {
    await checkpoint();
    await enterStage('configuration');
    validateRuntime(runtime);
    validatePassThreshold(passThreshold);
    validateReportOptions(projectFileOptions);
    validateInspectLinks(inspectLinks);
    validateSnapshotDirectoryName(snapshotDirName);
    report.runner = runtime.runner;
    report.inspect = {
      ...inspectLinks,
      project: 'project',
    };
    reportBudget.remainingBytes = readReportPatchBytes(
      projectFileOptions.maxReportPatchBytes,
    );
    await enterStage('scenario-definition');
    const scenarioDefinition = await readAgentScenarioDefinition(scenarioDir);
    const scenarioTurns = scenarioDefinition.turns;

    report.scenario.source = scenarioDefinition.source;
    replaceReportTurns(report, scenarioTurns);
    await checkpoint();

    await enterStage('agent-runtime');
    setReportAgentMetadata(report, await prepareAgentRuntime(runtime));
    await checkpoint();

    await enterStage('skill-definition');
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

    protectedStateOptions = {
      ignoredDirectoryNames: projectFileOptions.ignoredDirectoryNames,
      maxStateFileBytes: projectFileOptions.maxStateFileBytes,
      maxStateFiles: projectFileOptions.maxStateFiles,
      maxStateBytes: projectFileOptions.maxStateBytes,
    };
    stateOptions = {
      ...protectedStateOptions,
      ignoredPaths: ignoredProjectPaths,
      ignoredPathPrefixes: ignoredProjectPathPrefixes,
    };
    report.skillPackage = {
      name: skill.packageName,
      source: skill.packageSpec,
      skill: skill.name,
    };
    report.skillsCliVersion = skillsCliVersion === null || skillsCliVersion === undefined
      ? null
      : String(skillsCliVersion);
    await checkpoint();

    await enterStage('fixture-copy');
    await cp(projectFixtureDir, projectDir, {
      recursive: true,
      filter: (source) => basename(source) !== 'node_modules',
    });

    await enterStage('project-install');
    const { skillSource } = await installProject({
      projectDir,
      projectFixtureDir,
      repoRoot,
      skill,
      baseEnv: env,
    });

    await enterStage('fixture-prepare');
    await prepareProjectFixture(projectDir, {
      hiddenPackageScripts: projectFileOptions.hiddenPackageScripts,
    });
    const originalSkillsLock = await readOptionalFile(join(projectDir, 'skills-lock.json'));

    await enterStage('skill-install');
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

    const protectedState = await captureProjectState(projectDir, protectedStateOptions);
    initialProjectState = await captureProjectState(projectDir, stateOptions);
    const projectFilesBefore = await readProjectFiles(projectDir, evidenceOptions);

    await enterStage('agent-session');
    agentSession = await createAgentSession(runtime, {
      cwd: projectDir,
      outputDir: join(outputDir, 'agent-session'),
      baseEnv: env,
    });

    for (const [index, scenarioTurn] of scenarioTurns.entries()) {
      activeTurnIndex = index;
      activeTurnState = null;
      activeTurnResult = null;
      stage = `turn:${scenarioTurn.id}`;
      report.stage = stage;
      report.turns[index].status = 'running';
      await checkpoint();

      onProgress({
        type: 'turn:start',
        id: scenarioTurn.id,
        index: index + 1,
        total: scenarioTurns.length,
        source: scenarioTurn.source,
      });

      activeTurnState = await captureProjectState(projectDir, stateOptions);
      activeTurnResult = await agentSession.runTurn(scenarioTurn.prompt);
      const completeStateAfterTurn = await captureProjectState(
        projectDir,
        protectedStateOptions,
      );

      assertProjectPathsUnchanged(protectedState, completeStateAfterTurn, {
        paths: ['skills-lock.json'],
        pathPrefixes: [installedSkillPrefix],
      });

      const stateAfterTurn = await captureProjectState(projectDir, stateOptions);
      const activity = normalizeAgentActivity(
        activeTurnResult.activity ?? [],
        projectDir,
        outputDir,
      );
      const response = normalizeAgentResponse(
        activeTurnResult.response,
        projectDir,
        outputDir,
      );
      const changes = diffProjectStates(activeTurnState, stateAfterTurn);
      const reportChanges = diffProjectStatesForReport(
        activeTurnState,
        stateAfterTurn,
        reportOptions,
      );

      conversationTurns.push({
        ...scenarioTurn,
        activity,
        changes,
        response,
      });
      Object.assign(report.turns[index], {
        status: 'completed',
        response,
        activity,
        changes: reportChanges,
        error: null,
      });
      await checkpoint();

      activeTurnIndex = null;
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

    await enterStage('evidence');
    const finalProjectState = await captureProjectState(projectDir, stateOptions);
    const changes = diffProjectStates(initialProjectState, finalProjectState);

    report.changes = diffProjectStatesForReport(
      initialProjectState,
      finalProjectState,
      reportOptions,
    );
    finalReportChangesCaptured = true;

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

    await enterStage('judge');
    onProgress({ type: 'judge:start' });

    const judgment = await judge(runtime, {
      role: `${scenarioName}-judge`,
      prompt: judgePrompt,
      schema: judgeSchema,
      cwd: projectDir,
      outputDir: join(outputDir, 'judge'),
      baseEnv: env,
    });
    validateJudgment(judgment);
    const pass = Boolean(judgment.pass)
      && Number(judgment.score) >= passThreshold
      && (!Array.isArray(judgment.failedCriteria) || judgment.failedCriteria.length === 0);

    applyReportEvaluation(report, judgment, pass);
    await checkpoint();

    await enterStage('session-close');
    try {
      await closeAgentSession();
    } catch (closeError) {
      if (pass) {
        throw closeError;
      }

      recordArtifactWarning(`Could not close the agent session: ${closeError.message}`);
    }
    stage = 'complete';
    report.stage = stage;
    await checkpoint();

    if (pass && updateSnapshots) {
      stage = 'snapshot';
      report.stage = stage;
      await checkpoint();
      snapshotPath = await writeScenarioSnapshot({
        scenarioDir,
        snapshotDirName,
        report,
      });
      report.stage = 'complete';
      await checkpoint();
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
      reportPath: pass && !keepOutput ? undefined : reportPath,
      snapshotPath,
      artifactWriteErrors,
    };
  } catch (error) {
    const failureStage = stage;
    const restoreLatestCheckpoint = [
      'ERR_AGENT_E2E_REPORT_CONTRACT',
      'ERR_AGENT_E2E_REPORT_SIZE',
    ].includes(error.code) && latestPersistedReport;

    if (restoreLatestCheckpoint) {
      const warnings = [...artifactWriteErrors];

      replaceObject(report, latestPersistedReport);
      for (const warning of warnings) {
        addArtifactWarning(report.warnings, warning);
      }
    }

    const currentState = restoreLatestCheckpoint || !initialProjectState
      ? null
      : await captureProjectState(projectDir, stateOptions)
      .catch((captureError) => {
        recordArtifactWarning(
          `Could not capture project state for report.json: ${captureError.message}`,
        );
        return null;
      });

    if (activeTurnIndex !== null && !restoreLatestCheckpoint) {
      const reportTurn = report.turns[activeTurnIndex];

      if (reportTurn) {
        reportTurn.status = 'incomplete';
        reportTurn.error = serializeReportError(error);

        if (activeTurnResult) {
          try {
            reportTurn.activity = normalizeAgentActivity(
              activeTurnResult.activity ?? [],
              projectDir,
              outputDir,
            );
          } catch (reportError) {
            recordArtifactWarning(
              `Could not collect incomplete-turn activity: ${reportError.message}`,
            );
          }

          try {
            reportTurn.response = activeTurnResult.response
              ? normalizeAgentResponse(activeTurnResult.response, projectDir, outputDir)
              : null;
          } catch (reportError) {
            recordArtifactWarning(
              `Could not collect the incomplete-turn response: ${reportError.message}`,
            );
          }
        }

        try {
          if (activeTurnState && currentState) {
            reportTurn.changes = diffProjectStatesForReport(
              activeTurnState,
              currentState,
              reportOptions,
            );
          }
        } catch (reportError) {
          recordArtifactWarning(
            `Could not collect the incomplete-turn diff: ${reportError.message}`,
          );
        }
      }
    }

    if (
      initialProjectState
      && currentState
      && !finalReportChangesCaptured
      && !restoreLatestCheckpoint
    ) {
      try {
        report.changes = diffProjectStatesForReport(
          initialProjectState,
          currentState,
          reportOptions,
        );
      } catch (reportError) {
        recordArtifactWarning(
          `Could not collect the final diff for report.json: ${reportError.message}`,
        );
      }
    }

    markReportError(report, error, failureStage);
    await closeAgentSession().catch((closeError) => {
      recordArtifactWarning(
        `Could not close the agent session: ${closeError.message}`,
      );
    });
    const wroteErrorCheckpoint = await checkpoint({ fatal: false });

    if (!wroteErrorCheckpoint && latestPersistedReport) {
      replaceObject(report, latestPersistedReport);
      report.warnings = [];
      addArtifactWarning(
        report.warnings,
        'Some error-report details were omitted because the complete checkpoint was too large.',
      );
      markReportError(report, error, failureStage);
      await checkpoint({ fatal: false });
    }

    throw attachArtifactDetails(error, {
      outputDir,
      reportPath,
      artifactWriteErrors,
    });
  } finally {
    await closeAgentSession().catch(() => {});
  }
}

export function readSnapshotDirName(env = process.env) {
  const value = env.AGENT_E2E_SNAPSHOT_DIR ?? 'snapshot';

  return validateSnapshotDirectoryName(value, 'AGENT_E2E_SNAPSHOT_DIR');
}

function readReportPatchBytes(value) {
  const bytes = value ?? defaultReportPatchBytes;

  if (!Number.isInteger(bytes) || bytes < 0) {
    throw new Error('maxReportPatchBytes must be a non-negative integer.');
  }

  return bytes;
}

function validateReportOptions(options) {
  for (const [name, value] of [
    ['maxEvidenceFileBytes', options.maxEvidenceFileBytes],
    ['maxEvidenceBytes', options.maxEvidenceBytes],
    ['maxReportFileBytes', options.maxReportFileBytes],
    ['maxReportDiffBytes', options.maxReportDiffBytes],
    ['maxReportChanges', options.maxReportChanges],
    ['maxProjectFiles', options.maxProjectFiles],
    ['maxStateFileBytes', options.maxStateFileBytes],
    ['maxStateFiles', options.maxStateFiles],
    ['maxStateBytes', options.maxStateBytes],
  ]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`${name} must be a non-negative integer.`);
    }
  }
}

function validatePassThreshold(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('passThreshold must be a finite number from 0 to 1.');
  }
}

function validateRuntime(value) {
  if (typeof value.runner !== 'string' || value.runner.trim() === '') {
    throw new Error('runtime.runner must be a non-empty string.');
  }
}

function validateJudgment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Judge result must be an object.');
  }

  const judgmentBytes = jsonByteLength(value, 'Judge result');

  if (judgmentBytes > maxReportJudgmentBytes) {
    throw new Error(
      `Judge result exceeds the ${maxReportJudgmentBytes}-byte report limit.`,
    );
  }

  if (typeof value.pass !== 'boolean') {
    throw new Error('Judge result pass must be a boolean.');
  }

  if (
    typeof value.score !== 'number'
    || !Number.isFinite(value.score)
    || value.score < 0
    || value.score > 1
  ) {
    throw new Error('Judge result score must be a finite number from 0 to 1.');
  }

  if (!Array.isArray(value.failedCriteria) || !Array.isArray(value.requiredFixes)) {
    throw new Error('Judge result must include failedCriteria and requiredFixes arrays.');
  }

  if (value.failedCriteria.some((criterion) => (
    !criterion
    || typeof criterion !== 'object'
    || Array.isArray(criterion)
    || typeof criterion.id !== 'string'
    || typeof criterion.reason !== 'string'
  ))) {
    throw new Error('Each failed criterion must include string id and reason fields.');
  }

  const failedCriterionIds = value.failedCriteria.map((criterion) => criterion.id);

  if (new Set(failedCriterionIds).size !== failedCriterionIds.length) {
    throw new Error('Judge result failedCriteria must contain unique ids.');
  }

  if (value.requiredFixes.some((fix) => typeof fix !== 'string')) {
    throw new Error('Each required fix must be a string.');
  }

  if (typeof value.notes !== 'string') {
    throw new Error('Judge result notes must be a string.');
  }
}

function normalizeAgentResponse(response, projectDir, outputDir) {
  const normalized = normalizeRunnerPaths(response, projectDir, outputDir);

  if (jsonByteLength(normalized, 'Agent response') > maxReportResponseBytes) {
    throw new Error(
      `Agent response exceeds the ${maxReportResponseBytes}-byte report limit.`,
    );
  }

  return normalized;
}

function normalizeAgentActivity(activity, projectDir, outputDir) {
  if (!Array.isArray(activity)) {
    return [];
  }

  if (activity.length > maxReportActivityItems) {
    throw new Error(
      `Agent activity exceeds the ${maxReportActivityItems}-item report limit.`,
    );
  }

  let activityItems = activity.length;
  const normalized = activity.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    if (item.type === 'command_execution') {
      return [{
        type: 'command_execution',
        commandSummary: normalizeRunnerPaths(item.commandSummary, projectDir, outputDir),
        exitCode: Number.isInteger(item.exitCode) ? item.exitCode : null,
        status: nullableText(item.status),
      }];
    }

    if (item.type === 'file_change') {
      activityItems += Array.isArray(item.changes) ? item.changes.length : 0;

      if (activityItems > maxReportActivityItems) {
        throw new Error(
          `Agent activity exceeds the ${maxReportActivityItems}-item report limit.`,
        );
      }

      return [{
        type: 'file_change',
        status: nullableText(item.status),
        changes: (Array.isArray(item.changes) ? item.changes : []).flatMap((change) => {
          if (!change || typeof change !== 'object' || Array.isArray(change)) {
            return [];
          }

          return [{
            path: normalizeActivityPath(change.path, projectDir, outputDir),
            kind: nullableText(change.kind),
          }];
        }),
      }];
    }

    if (item.type === 'mcp_tool_call') {
      return [{
        type: 'mcp_tool_call',
        server: nullableText(item.server),
        tool: nullableText(item.tool),
        status: nullableText(item.status),
      }];
    }

    if (item.type === 'web_search') {
      return [{
        type: 'web_search',
        query: item.query === undefined || item.query === null
          ? null
          : normalizeRunnerPaths(item.query, projectDir, outputDir),
        status: nullableText(item.status),
      }];
    }

    return [];
  });

  if (jsonByteLength(normalized, 'Agent activity') > maxReportActivityBytes) {
    throw new Error(
      `Agent activity exceeds the ${maxReportActivityBytes}-byte report limit.`,
    );
  }

  return normalized;
}

function normalizeActivityPath(path, projectDir, outputDir) {
  const normalizedPath = String(path ?? '').replaceAll('\\', '/');
  const normalizedProjectDir = projectDir.replaceAll('\\', '/');

  if (normalizedPath.startsWith(`${normalizedProjectDir}/`)) {
    return normalizedPath.slice(normalizedProjectDir.length + 1);
  }

  return normalizeRunnerPaths(path, projectDir, outputDir);
}

function normalizeRunnerPaths(value, projectDir, outputDir) {
  return String(value ?? '')
    .replaceAll(projectDir, '<project>')
    .replaceAll(projectDir.replaceAll('\\', '/'), '<project>')
    .replaceAll(outputDir, '<test-output>')
    .replaceAll(outputDir.replaceAll('\\', '/'), '<test-output>');
}

function nullableText(value) {
  return value === undefined || value === null ? null : String(value);
}

function jsonByteLength(value, label) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (error) {
    throw new Error(`${label} is not JSON-serializable: ${error.message}`);
  }
}

function addArtifactWarning(warnings, message) {
  const warning = truncateReportWarning(message);

  if (warnings.includes(warning)) {
    return;
  }

  const omittedWarning = 'Further artifact warnings were omitted.';

  if (warnings.length < maxReportWarnings - 1) {
    warnings.push(warning);
  } else if (warnings.length === maxReportWarnings - 1) {
    warnings.push(omittedWarning);
  }
}

function validateInspectLinks(value) {
  if (Object.hasOwn(value, 'project')) {
    throw new Error('inspectLinks.project is reserved for the retained project path.');
  }

  for (const [name, path] of Object.entries(value)) {
    if (typeof path !== 'string' || path.length === 0) {
      throw new Error(`inspectLinks.${name} must be a non-empty string.`);
    }

    const normalized = path.replaceAll('\\', '/');
    const segments = normalized.split('/');

    if (
      isAbsolute(path)
      || normalized.startsWith('/')
      || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
      || segments.includes('..')
      || normalized.includes('\0')
    ) {
      throw new Error(`inspectLinks.${name} must be repository-relative.`);
    }
  }
}

function replaceObject(target, source) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, structuredClone(source));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function attachArtifactDetails(error, details) {
  let target = error instanceof Error ? error : new Error(String(error));

  if (!Object.isExtensible(target)) {
    target = new Error(target.message, { cause: target });
  }

  target.outputDir = details.outputDir;
  target.reportPath = details.reportPath;
  target.artifactWriteErrors = details.artifactWriteErrors;

  return target;
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
