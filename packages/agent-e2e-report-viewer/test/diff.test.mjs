import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyDiffLine,
  numberDiffLines,
  omissionMessage,
} from '../src/diff.mjs';

test('classifyDiffLine distinguishes unified diff rows', () => {
  assert.equal(classifyDiffLine('@@ -2,2 +2,3 @@'), 'hunk');
  assert.equal(classifyDiffLine('+++ b/README.md'), 'file-header');
  assert.equal(classifyDiffLine('+added'), 'addition');
  assert.equal(classifyDiffLine('-removed'), 'deletion');
  assert.equal(classifyDiffLine(' unchanged'), 'context');
});

test('numberDiffLines tracks both sides of a hunk', () => {
  const rows = numberDiffLines([
    '@@ -4,3 +8,3 @@',
    ' context',
    '-before',
    '+after',
    ' final',
  ]);

  assert.deepEqual(
    rows.map(({ oldNumber, newNumber }) => [oldNumber, newNumber]),
    [[null, null], [4, 8], [5, null], [null, 9], [6, 10]],
  );
});

test('omissionMessage describes privacy omissions', () => {
  assert.equal(
    omissionMessage({ omission: { reason: 'sensitive-path' } }),
    'Diff omitted for a potentially sensitive path.',
  );
});

test('omissionMessage includes the omitted patch size', () => {
  assert.equal(
    omissionMessage({ omission: { reason: 'diff-too-large', byteLength: 2048 } }),
    'Diff omitted because the patch is too large (2048 bytes).',
  );
});
