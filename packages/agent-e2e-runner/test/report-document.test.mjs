import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  applyReportEvaluation,
  createScenarioReport,
  markReportError,
  maxReportErrorMessageBytes,
  maxReportErrorNameBytes,
  maxReportWarningBytes,
  serializeReportError,
  truncateReportWarning,
  validateScenarioReport,
  writeReportJson,
} from '../src/report-document.mjs';

test('createScenarioReport records scenario turns before they run', () => {
  const report = createScenarioReport({
    scenarioName: 'example',
    runner: 'codex',
    turns: [{
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Update docs.',
      criteria: [{ id: 'request.docs', content: 'Docs are updated.' }],
    }],
  });

  assert.equal(report.format, 'agent-e2e-report');
  assert.equal(report.formatVersion, 1);
  assert.equal(report.status, 'running');
  assert.deepEqual(report.warnings, []);
  assert.equal(report.turns[0].status, 'pending');
  assert.equal(report.turns[0].response, null);
  assert.equal(report.turns[0].criteria[0].status, 'not-evaluated');
});

test('applyReportEvaluation keeps passed criteria on threshold-only failures', () => {
  const report = createScenarioReport({
    scenarioName: 'threshold',
    passThreshold: 0.8,
    turns: [{
      id: 'request',
      prompt: 'Update docs.',
      criteria: [{ id: 'request.docs', content: 'Docs are updated.' }],
    }],
  });

  applyReportEvaluation(report, {
    pass: true,
    score: 0.7,
    failedCriteria: [],
    requiredFixes: [],
    notes: 'Below the configured threshold.',
  }, false);

  assert.equal(report.status, 'failed');
  assert.equal(report.evaluation.outcomeReason, 'score-below-threshold');
  assert.equal(report.turns[0].criteria[0].status, 'passed');
});

test('applyReportEvaluation marks unlisted criteria as passed after a partial failure', () => {
  const report = createScenarioReport({
    scenarioName: 'partial-failure',
    turns: [{
      id: 'request',
      status: 'completed',
      prompt: 'Update docs and tests.',
      response: 'Updated the documentation.',
      criteria: [
        { id: 'request.docs', content: 'Docs are updated.' },
        { id: 'request.tests', content: 'Tests are updated.' },
      ],
    }],
  });

  applyReportEvaluation(report, {
    pass: false,
    score: 0.5,
    failedCriteria: [{ id: 'request.tests', reason: 'Tests are stale.' }],
    requiredFixes: ['Update the tests.'],
    notes: 'The documentation passed.',
  }, false);

  assert.equal(report.turns[0].criteria[0].status, 'passed');
  assert.equal(report.turns[0].criteria[0].reason, '');
  assert.equal(report.turns[0].criteria[1].status, 'failed');
  assert.equal(report.turns[0].criteria[1].reason, 'Tests are stale.');
  assert.equal(validateScenarioReport(report), report);

  report.turns[0].criteria[0].status = 'not-evaluated';
  assert.throws(
    () => validateScenarioReport(report),
    /Criterion "request\.docs" disagrees with report\.evaluation/,
  );
});

test('applyReportEvaluation does not pass with reported failed criteria', () => {
  const report = createScenarioReport({
    scenarioName: 'inconsistent-judge',
    turns: [{
      id: 'request',
      prompt: 'Update docs.',
      criteria: [{ id: 'request.docs', content: 'Docs are updated.' }],
    }],
  });

  applyReportEvaluation(report, {
    pass: true,
    score: 1,
    failedCriteria: [{ id: 'request.docs', reason: 'The docs are stale.' }],
    requiredFixes: [],
    notes: '',
  }, true);

  assert.equal(report.status, 'failed');
  assert.equal(report.evaluation.effectivePass, false);
  assert.equal(report.evaluation.outcomeReason, 'criteria-failed');
  assert.equal(report.turns[0].criteria[0].status, 'failed');
});

test('createScenarioReport keeps only serializable agent metadata and inspect links', () => {
  const report = createScenarioReport({
    scenarioName: 'normalized',
    agentMetadata: {
      name: 'codex',
      secretInternalField: 'not part of the format',
      model: {
        agent: {
          name: 'test-model',
          label: 'Test model',
          source: { name: 'config.toml' },
          rawConfig: { unsafe: true },
        },
      },
    },
    inspect: {
      project: 'project',
      ignored: null,
    },
  });

  assert.deepEqual(report.agent, {
    name: 'codex',
    model: {
      agent: {
        name: 'test-model',
        reasoningEffort: null,
        label: 'Test model',
        source: { name: 'config.toml' },
      },
    },
  });
  assert.deepEqual(report.inspect, { project: 'project' });
});

test('markReportError keeps the active turn as incomplete', () => {
  const report = createScenarioReport({
    scenarioName: 'runtime',
    turns: [{ id: 'change', prompt: 'Change it.', criteria: [] }],
  });

  report.turns[0].status = 'running';
  markReportError(report, new Error('Stopped.\nraw details'), 'turn:change');

  assert.equal(report.status, 'error');
  assert.equal(report.stage, 'turn:change');
  assert.equal(report.error.message, 'Stopped.');
  assert.equal(report.turns[0].status, 'incomplete');
  assert.deepEqual(report.turns[0].error, report.error);
});

test('report errors and warnings are bounded before persistence', () => {
  const error = serializeReportError({
    name: 'N'.repeat(maxReportErrorNameBytes * 2),
    message: `${'M'.repeat(maxReportErrorMessageBytes * 2)}\nnot included`,
  });
  const warning = truncateReportWarning('W'.repeat(maxReportWarningBytes * 2));

  assert.ok(Buffer.byteLength(error.name, 'utf8') <= maxReportErrorNameBytes);
  assert.ok(Buffer.byteLength(error.message, 'utf8') <= maxReportErrorMessageBytes);
  assert.ok(Buffer.byteLength(warning, 'utf8') <= maxReportWarningBytes);
  assert.match(error.message, /\.\.\. \[truncated\]$/);
  assert.match(warning, /\.\.\. \[truncated\]$/);
  assert.doesNotMatch(error.message, /not included/);
});

test('writeReportJson atomically writes one parseable report file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-report-json-'));
  const report = createScenarioReport({ scenarioName: 'atomic' });

  await mkdir(root, { recursive: true });
  const path = await writeReportJson(root, report);
  const content = await readFile(path, 'utf8');

  assert.equal(path, join(root, 'report.json'));
  assert.equal(JSON.parse(content).scenario.name, 'atomic');
  assert.equal(content.endsWith('\n'), true);
  assert.deepEqual(await readdir(root), ['report.json']);
});

test('writeReportJson keeps the previous checkpoint when a replacement exceeds the limit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-report-limit-'));
  const report = createScenarioReport({ scenarioName: 'bounded' });

  await mkdir(root, { recursive: true });
  const path = await writeReportJson(root, report);
  const previousContent = await readFile(path, 'utf8');

  report.scenario.name = 'replacement';

  await assert.rejects(
    () => writeReportJson(root, report, { maxBytes: 16 }),
    /Report document exceeds maxReportDocumentBytes/,
  );
  assert.equal(await readFile(path, 'utf8'), previousContent);
  assert.deepEqual(await readdir(root), ['report.json']);
});

test('validateScenarioReport rejects fields outside the versioned contract', () => {
  const report = createScenarioReport({ scenarioName: 'invalid-field' });

  report.rawAgentEvents = [];

  assert.throws(
    () => validateScenarioReport(report),
    /report contains unexpected field "rawAgentEvents"/,
  );
});

test('validateScenarioReport requires one safe representation for each change', () => {
  const report = createScenarioReport({ scenarioName: 'invalid-change' });

  report.changes.push({
    path: 'README.md',
    status: 'created',
    before: null,
    after: { kind: 'text', byteLength: 5 },
    patch: {
      format: 'unified',
      lines: ['--- /dev/null', '+++ b/README.md', '@@ -0,0 +1 @@', '+Hello'],
    },
    omission: { reason: 'sensitive-path' },
  });

  assert.throws(
    () => validateScenarioReport(report),
    /exactly one of patch or omission/,
  );

  report.changes[0].omission = null;
  report.changes[0].path = '.env';
  assert.throws(
    () => validateScenarioReport(report),
    /patch must not contain sensitive report data/,
  );

  report.changes[0].path = '../README.md';
  assert.throws(
    () => validateScenarioReport(report),
    /must be a relative path without parent traversal/,
  );

  report.changes[0].path = 'README.md';
  report.changes[0].after.kind = 'binary';
  assert.throws(
    () => validateScenarioReport(report),
    /patch requires text file versions/,
  );

  report.changes[0].after.kind = 'text';
  report.changes[0].patch = null;
  assert.throws(
    () => validateScenarioReport(report),
    /exactly one of patch or omission/,
  );

  report.changes[0].omission = { reason: 'empty-file' };
  report.changes[0].before = { kind: 'text', byteLength: 0 };
  assert.throws(
    () => validateScenarioReport(report),
    /only an after version when created/,
  );
});

test('validateScenarioReport requires completed turns in terminal reports', () => {
  const report = createScenarioReport({
    scenarioName: 'unfinished-pass',
    turns: [{
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Update docs.',
      criteria: [{
        id: 'request.docs',
        source: 'scenario.json#/turns/0/criteria/docs',
        content: 'Docs are updated.',
      }],
    }],
  });

  applyReportEvaluation(report, {
    pass: true,
    score: 1,
    failedCriteria: [],
    requiredFixes: [],
    notes: '',
  }, true);

  assert.throws(
    () => validateScenarioReport(report),
    /passed report must contain only completed turns/,
  );

  report.turns[0].status = 'completed';
  report.turns[0].response = 'Updated docs.';
  assert.equal(validateScenarioReport(report), report);
});

test('validateScenarioReport rejects results on pending turns', () => {
  const report = createScenarioReport({
    scenarioName: 'pending-result',
    turns: [{
      id: 'request',
      prompt: 'Update docs.',
      criteria: [],
    }],
  });

  report.turns[0].response = 'Unexpected response.';

  assert.throws(
    () => validateScenarioReport(report),
    /cannot contain results while pending/,
  );
});

test('validateScenarioReport rejects evaluated errors with unfinished turns', () => {
  const report = createScenarioReport({
    scenarioName: 'evaluated-unfinished',
    turns: [{
      id: 'request',
      prompt: 'Update docs.',
      criteria: [],
    }],
  });

  applyReportEvaluation(report, {
    pass: true,
    score: 1,
    failedCriteria: [],
    requiredFixes: [],
    notes: '',
  }, true);
  markReportError(report, new Error('Cleanup failed.'), 'session-close');

  assert.throws(
    () => validateScenarioReport(report),
    /evaluated error report must contain only completed turns/i,
  );
});

test('validateScenarioReport rejects duplicate report identifiers', () => {
  const duplicateTurns = createScenarioReport({
    scenarioName: 'duplicate-turns',
    turns: [
      { id: 'request', prompt: 'One.', criteria: [] },
      { id: 'request', prompt: 'Two.', criteria: [] },
    ],
  });

  assert.throws(
    () => validateScenarioReport(duplicateTurns),
    /report\.turns contains duplicate id "request"/,
  );

  const duplicateCriteria = createScenarioReport({
    scenarioName: 'duplicate-criteria',
    turns: [{
      id: 'request',
      prompt: 'One.',
      criteria: [
        { id: 'request.result', content: 'One.' },
        { id: 'request.result', content: 'Two.' },
      ],
    }],
  });

  assert.throws(
    () => validateScenarioReport(duplicateCriteria),
    /report criteria contains duplicate id "request\.result"/,
  );

  duplicateCriteria.turns[0].criteria = [];
  duplicateCriteria.evaluation = {
    judgePass: false,
    effectivePass: false,
    score: 0,
    passThreshold: 0.8,
    outcomeReason: 'criteria-failed',
    failedCriteria: [
      { id: 'unknown', reason: 'One.' },
      { id: 'unknown', reason: 'Two.' },
    ],
    unknownFailedCriteria: [],
    requiredFixes: [],
    notes: '',
  };

  assert.throws(
    () => validateScenarioReport(duplicateCriteria),
    /report\.evaluation\.failedCriteria contains duplicate id "unknown"/,
  );
});

test('validateScenarioReport enforces portable inspect paths', () => {
  const report = createScenarioReport({
    scenarioName: 'unsafe-inspect',
    inspect: { project: '../project' },
  });

  assert.throws(
    () => validateScenarioReport(report),
    /report\.inspect\.project must be a relative path without parent traversal/,
  );

  report.inspect = { log: 'https://example.test/events.jsonl' };
  assert.throws(
    () => validateScenarioReport(report),
    /report\.inspect\.log must be a relative path without parent traversal/,
  );
});

test('validateScenarioReport rejects inconsistent evaluation state', () => {
  const report = createScenarioReport({
    scenarioName: 'inconsistent-evaluation',
    turns: [{
      id: 'request',
      prompt: 'Update docs.',
      criteria: [{ id: 'request.docs', content: 'Docs are updated.' }],
    }],
  });

  applyReportEvaluation(report, {
    pass: true,
    score: 1,
    failedCriteria: [],
    requiredFixes: [],
    notes: '',
  }, true);
  report.evaluation.failedCriteria.push({
    id: 'request.docs',
    reason: 'Contradictory failure.',
  });

  assert.throws(
    () => validateScenarioReport(report),
    /inconsistent with an effective pass/,
  );

  report.evaluation.failedCriteria = [];
  report.status = 'failed';
  assert.throws(
    () => validateScenarioReport(report),
    /disagrees with evaluation\.effectivePass/,
  );
});
