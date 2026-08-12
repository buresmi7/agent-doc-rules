import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSensitiveReportContent,
  isSensitiveReportPath,
  maxReportDocumentBytes,
  reportFormat,
  reportFormatVersion,
  validateScenarioReport,
} from '../src/index.mjs';

function createMinimalReport() {
  return {
    format: reportFormat,
    formatVersion: reportFormatVersion,
    revision: 0,
    status: 'running',
    stage: 'initializing',
    scenario: {
      name: 'Contract test',
      source: 'scenario.json',
    },
    runner: 'test',
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

test('exports the versioned report contract', () => {
  const report = createMinimalReport();

  assert.equal(reportFormat, 'agent-e2e-report');
  assert.equal(reportFormatVersion, 1);
  assert.equal(maxReportDocumentBytes, 48 * 1024 * 1024);
  assert.equal(validateScenarioReport(report), report);
});

test('rejects documents from another format version', () => {
  const report = createMinimalReport();

  report.formatVersion = 2;

  assert.throws(
    () => validateScenarioReport(report),
    /report\.formatVersion must equal 1/,
  );
});

test('shares browser-safe diff redaction checks with report producers', () => {
  const privateKey = new TextEncoder().encode(
    '-----BEGIN OPENSSH PRIVATE KEY-----\nsecret',
  );

  assert.equal(isSensitiveReportPath('config/.env.production'), true);
  assert.equal(isSensitiveReportPath('src/config.js'), false);
  assert.equal(isSensitiveReportContent(privateKey), true);
  assert.equal(isSensitiveReportContent('ordinary report text'), false);
});
