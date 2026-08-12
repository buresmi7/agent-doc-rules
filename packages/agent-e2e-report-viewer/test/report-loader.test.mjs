import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatByteSize,
  parseReportText,
  readReportFile,
} from '../src/report-loader.mjs';

function validReport() {
  return {
    format: 'agent-e2e-report',
    formatVersion: 1,
    revision: 0,
    status: 'running',
    stage: 'initializing',
    scenario: {
      name: 'viewer fixture',
      source: 'scenario.json',
    },
    runner: 'codex',
    agent: null,
    skillsCliVersion: null,
    skillPackage: null,
    passThreshold: 0.8,
    turns: [],
    changes: [],
    evaluation: null,
    error: null,
    warnings: [],
    inspect: {},
  };
}

test('parseReportText returns a valid report', () => {
  const report = validReport();

  assert.deepEqual(parseReportText(JSON.stringify(report)), report);
});

test('parseReportText reports invalid JSON without exposing parser details', () => {
  assert.throws(
    () => parseReportText('{ nope'),
    (error) => {
      assert.equal(error.code, 'invalid-json');
      assert.match(error.message, /not valid JSON/);
      return true;
    },
  );
});

test('parseReportText explains an incompatible report contract', () => {
  const report = validReport();
  report.formatVersion = 99;

  assert.throws(
    () => parseReportText(JSON.stringify(report)),
    (error) => {
      assert.equal(error.code, 'invalid-report');
      assert.match(error.message, /v99/);
      return true;
    },
  );
});

test('readReportFile rejects an oversized file before reading it', async () => {
  let read = false;
  const file = {
    size: 101,
    async text() {
      read = true;
      return JSON.stringify(validReport());
    },
  };

  await assert.rejects(
    readReportFile(file, { maxBytes: 100 }),
    (error) => error.code === 'report-too-large',
  );
  assert.equal(read, false);
});

test('formatByteSize formats the report limit for people', () => {
  assert.equal(formatByteSize(48 * 1024 * 1024), '48.0 MiB');
  assert.equal(formatByteSize(700), '700 B');
});
