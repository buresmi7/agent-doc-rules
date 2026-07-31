import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildFailureSummary,
  createAgentSessionDocument,
  escapeHtml,
  renderFailureReport,
  renderSessionViewer,
  sessionItemSource,
  writeFailureArtifacts,
} from '../src/index.mjs';

test('writeFailureArtifacts writes a self-contained judged failure report', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-report-'));
  const outputDir = join(root, 'output');
  const projectDir = join(outputDir, 'project');
  const scenarioDir = join(root, 'e2e/example');

  await mkdir(projectDir, { recursive: true });
  await mkdir(scenarioDir, { recursive: true });

  const conversationTurns = [{
    id: 'request',
    source: 'scenario.json#/turns/0',
    prompt: 'Write <script>alert("prompt")</script>.',
    response: 'Updated README.',
    criteria: [{
      id: 'request.docs',
      source: 'scenario.json#/turns/0/criteria/docs',
      content: 'Document the change.',
    }],
    activity: [{
      type: 'command_execution',
      commandSummary: 'npm test',
      exitCode: 0,
      status: 'completed',
    }],
    changes: [{
      path: 'README.md',
      status: 'modified',
      content: '# After\n',
    }],
    reportChanges: [{
      path: 'README.md',
      status: 'modified',
      before: { kind: 'text', content: '# Before\n', byteLength: 9 },
      after: { kind: 'text', content: '# After\n', byteLength: 8 },
    }],
  }];
  const result = await writeFailureArtifacts({
    outputDir,
    projectDir,
    scenarioDir,
    repoRoot: root,
    scenarioName: 'example',
    runner: 'codex',
    scenarioSource: 'scenario.json',
    stage: 'judge',
    changes: conversationTurns[0].changes,
    reportChanges: conversationTurns[0].reportChanges,
    conversationTurns,
    judgment: {
      pass: false,
      score: 0.4,
      failedCriteria: [{
        id: 'request.docs',
        reason: 'README is incomplete.',
        evidence: [{
          target: 'response',
          path: '',
          quote: 'Updated README',
        }],
      }],
      requiredFixes: ['Add the missing section.'],
      notes: 'The project change was incomplete.',
    },
    transcript: 'User and agent transcript.',
  });

  assert.deepEqual(result.writeErrors, []);
  await access(result.failureSummaryPath);
  await access(result.failureReportPath);
  await access(result.agentSessionPath);

  const summary = JSON.parse(await readFile(result.failureSummaryPath, 'utf8'));
  const session = JSON.parse(await readFile(result.agentSessionPath, 'utf8'));
  const html = await readFile(result.failureReportPath, 'utf8');

  assert.equal(summary.status, 'judged-failure');
  assert.equal(summary.turns[0].prompt, 'Write <script>alert("prompt")</script>.');
  assert.equal(session.format, 'agent-session');
  assert.equal(session.turns[0].expectations[0].status, 'failed');
  assert.equal(session.turns[0].expectations[0].text, 'Document the change.');
  assert.match(html, /Turn 1: request/);
  assert.match(html, /Expected for this response/);
  assert.match(html, /Document the change/);
  assert.match(html, /<mark class="annotation failure"[^>]*>Updated README<\/mark>/);
  assert.match(html, /README is incomplete/);
  assert.match(html, /# Before/);
  assert.match(html, /# After/);
  assert.match(html, /href="project\/README\.md"/);
  assert.match(html, /npm test/);
  assert.match(html, /&lt;script&gt;alert\(&quot;prompt&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<script src=/);
});

test('renderFailureReport shows runtime errors and incomplete turns', () => {
  const summary = buildFailureSummary({
    outputDir: '/tmp/agent-e2e-example',
    projectDir: '/tmp/agent-e2e-example/project',
    scenarioDir: '/repo/e2e/example',
    repoRoot: '/repo',
    scenarioName: 'example',
    runner: 'codex',
    scenarioSource: 'scenario.json',
    stage: 'turn:request',
    error: new Error('Codex stopped.\nraw command output'),
    conversationTurns: [{
      id: 'request',
      source: 'scenario.json#/turns/0',
      prompt: 'Update README.',
      response: '',
      activity: [],
      changes: [],
      incomplete: true,
    }],
  });
  const html = renderFailureReport({
    summary,
    conversationTurns: [{
      ...summary.turns[0],
      reportChanges: [],
    }],
  });

  assert.equal(summary.status, 'runtime-error');
  assert.equal(summary.error.message, 'Codex stopped.');
  assert.match(html, /Runtime error/);
  assert.match(html, /Codex stopped\./);
  assert.doesNotMatch(html, /raw command output/);
  assert.match(html, /incomplete/);
  assert.match(html, /No agent response was recorded/);
});

test('writeFailureArtifacts reports write errors without replacing the scenario failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-report-write-'));
  const outputDir = join(root, 'missing/output');
  const result = await writeFailureArtifacts({
    outputDir,
    projectDir: join(outputDir, 'project'),
    scenarioDir: join(root, 'scenario'),
    repoRoot: root,
    scenarioName: 'write-error',
    runner: 'codex',
    scenarioSource: 'scenario.json',
    stage: 'judge',
    judgment: {
      score: 0,
      failedCriteria: [],
      requiredFixes: [],
      notes: '',
    },
  });

  assert.equal(result.failureSummaryPath, undefined);
  assert.equal(result.failureReportPath, undefined);
  assert.equal(result.agentSessionPath, undefined);
  assert.equal(result.writeErrors.length, 3);
  assert.match(result.writeErrors[0], /Could not write failure summary/);
  assert.match(result.writeErrors[1], /Could not write agent session/);
  assert.match(result.writeErrors[2], /Could not write failure report/);
});

test('renderSessionViewer highlights annotated response text', () => {
  const itemId = 'request:assistant';
  const session = createAgentSessionDocument({
    title: 'Annotated session',
    turns: [{
      id: 'request',
      status: 'completed',
      items: [{
        id: itemId,
        type: 'assistant_message',
        text: 'Updated README and docs.',
      }],
      expectations: [{
        id: 'request.docs',
        text: 'Update the documentation.',
        source: 'scenario.json#/turns/0/criteria/docs',
        status: 'passed',
        reason: '',
        targetItemId: itemId,
      }],
      projectChanges: [],
    }],
    annotations: [{
      id: 'highlight-readme',
      type: 'Annotation',
      motivation: 'highlighting',
      body: {
        type: 'TextualBody',
        value: 'Relevant response evidence',
      },
      target: {
        source: sessionItemSource(itemId),
        selector: {
          type: 'TextQuoteSelector',
          exact: 'README',
        },
      },
    }],
  });
  const html = renderSessionViewer(session);

  assert.match(html, /<mark class="annotation"[^>]*>README<\/mark>/);
  assert.match(html, /Relevant response evidence/);
  assert.match(html, /Update the documentation/);
});

test('renderSessionViewer rejects unsafe project link bases', () => {
  const html = renderSessionViewer(createAgentSessionDocument({
    title: 'Unsafe link',
    turns: [],
    project: {
      filesHrefBase: 'javascript:alert(1)',
      finalChanges: [{
        path: 'README.md',
        status: 'modified',
        before: { kind: 'text', content: 'Before' },
        after: { kind: 'text', content: 'After' },
      }],
    },
  }));

  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /<a href=/);
});

test('escapeHtml escapes text and attribute delimiters', () => {
  assert.equal(
    escapeHtml('<a href="x">Tom & Jerry\'s</a>'),
    '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
  );
});
