import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activityStatus,
  overviewSubtitle,
} from '../src/presentation.mjs';

test('activityStatus gives a non-zero command exit code precedence', () => {
  assert.equal(activityStatus({ exitCode: 1, status: 'completed' }), 'failed');
  assert.equal(activityStatus({ exitCode: 0, status: 'failed' }), 'completed');
  assert.equal(activityStatus({ exitCode: null, status: 'running' }), 'running');
});

test('overviewSubtitle explains score and criteria failures accurately', () => {
  assert.match(overviewSubtitle({
    status: 'failed',
    evaluation: { outcomeReason: 'score-below-threshold', failedCriteria: [] },
  }), /score was below/);
  assert.match(overviewSubtitle({
    status: 'failed',
    evaluation: { outcomeReason: 'criteria-failed', failedCriteria: [{ id: 'criterion' }] },
  }), /expectations did not pass/);
  assert.match(overviewSubtitle({
    status: 'failed',
    evaluation: { outcomeReason: 'criteria-failed', failedCriteria: [] },
  }), /judge did not accept/);
});
