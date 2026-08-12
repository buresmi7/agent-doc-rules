import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateScenarioReport } from '@buresmi7/agent-e2e-report';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const e2eRoot = join(packageRoot, 'e2e');

test('all checked-in agent snapshots satisfy the report format', async () => {
  const entries = await readdir(e2eRoot, { withFileTypes: true });
  const expectedScenarioNames = [];
  const actualReportNames = [];
  const scenarioDefinitions = new Map();

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const scenarioPath = join(e2eRoot, entry.name, 'scenario.json');
    const scenarioContent = await readFile(scenarioPath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    });

    const scenarioDefinition = scenarioContent ? JSON.parse(scenarioContent) : null;

    if (Array.isArray(scenarioDefinition?.turns)) {
      expectedScenarioNames.push(entry.name);
      scenarioDefinitions.set(entry.name, scenarioDefinition);
    }

    const reportPath = join(e2eRoot, entry.name, 'snapshot/report.json');
    const reportContent = await readFile(reportPath, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    });

    if (reportContent) {
      actualReportNames.push(entry.name);
    }
  }

  expectedScenarioNames.sort();
  actualReportNames.sort();
  assert.ok(expectedScenarioNames.length > 0);
  assert.deepEqual(actualReportNames, expectedScenarioNames);

  for (const scenarioName of expectedScenarioNames) {
    const report = JSON.parse(await readFile(
      join(e2eRoot, scenarioName, 'snapshot/report.json'),
      'utf8',
    ));

    assert.doesNotThrow(
      () => validateScenarioReport(report),
      `${scenarioName}/snapshot/report.json`,
    );
    assert.equal(report.scenario.name, scenarioName);
    assert.equal(report.status, 'passed');
    assert.equal(report.stage, 'complete');
    assert.equal(report.revision, 1);
    assert.ok(Array.isArray(report.warnings));
    assert.deepEqual(report.inspect, {});
    assert.deepEqual(
      await readdir(join(e2eRoot, scenarioName, 'snapshot')),
      ['report.json'],
    );

    const scenarioTurns = scenarioDefinitions.get(scenarioName).turns;

    assert.equal(report.turns.length, scenarioTurns.length);
    report.turns.forEach((turn, index) => {
      const scenarioTurn = scenarioTurns[index];
      const expectedCriteria = Object.entries(scenarioTurn.criteria).map(
        ([id, content]) => ({
          id: `${scenarioTurn.id}.${id}`,
          content: content.trim(),
        }),
      );

      assert.equal(turn.id, scenarioTurn.id);
      assert.equal(turn.prompt, scenarioTurn.prompt.trim());
      assert.equal(turn.status, 'completed');
      assert.equal(typeof turn.response, 'string');
      assert.deepEqual(
        turn.criteria.map(({ id, content }) => ({ id, content })),
        expectedCriteria,
      );
    });
  }
});
