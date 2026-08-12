import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  compareSemver,
  currentChangelogEntry,
  currentChangelogVersion,
  loadReleaseMetadata,
  packageNpmUrl,
  packageReleaseTitle,
  parseSemver,
  releaseBodyStartsWithCurrentChangelogEntry,
  repoRoot,
} from '../release-metadata.mjs';

const run = promisify(execFile);

test('release metadata maps every public package to an independent tag', async () => {
  const metadata = await loadReleaseMetadata();

  assert.equal(metadata.packages.length, 5);
  assert.equal(new Set(metadata.packages.map((entry) => entry.name)).size, 5);
  assert.equal(new Set(metadata.packages.map((entry) => entry.releaseTitle)).size, 5);
  assert.equal(new Set(metadata.packages.map((entry) => entry.tag)).size, 5);

  for (const entry of metadata.packages) {
    assert.equal(entry.tag, `${entry.tagPrefix}@${entry.version}`);
    assert.equal(packageReleaseTitle(entry), `${entry.releaseTitle} ${entry.version}`);
    assert.equal(
      packageNpmUrl(entry),
      `https://www.npmjs.com/package/${entry.name}/v/${entry.version}`,
    );
    assert.equal(currentChangelogVersion(entry.changelog), entry.version);
    assert.notEqual(currentChangelogEntry(entry.changelog), null);
  }

  assert.deepEqual(
    metadata.packages.map(({ name, releaseTitle }) => ({ name, releaseTitle })),
    [
      {
        name: '@buresmi7/agent-doc-rules-skill',
        releaseTitle: 'Agent Doc Rules Skill',
      },
      {
        name: '@buresmi7/agent-e2e-runner',
        releaseTitle: 'E2E Runner',
      },
      {
        name: '@buresmi7/agent-e2e-report',
        releaseTitle: 'E2E Report Format',
      },
      {
        name: '@buresmi7/agent-doc-rules-docs-validator',
        releaseTitle: 'Docs Validator',
      },
      {
        name: '@buresmi7/agent-doc-rules-docs-duplicates',
        releaseTitle: 'Docs Duplicate Checker',
      },
    ],
  );
});

test('parseSemver accepts release and prerelease versions', () => {
  assert.deepEqual(parseSemver('0.11.0'), {
    major: 0,
    minor: 11,
    patch: 0,
    prerelease: [],
  });
  assert.deepEqual(parseSemver('1.2.3-next.4+build.7'), {
    major: 1,
    minor: 2,
    patch: 3,
    prerelease: ['next', '4'],
  });
});

test('parseSemver rejects invalid numeric identifiers', () => {
  assert.equal(parseSemver('01.2.3'), null);
  assert.equal(parseSemver('1.02.3'), null);
  assert.equal(parseSemver('1.2.03'), null);
  assert.equal(parseSemver('1.2.3-next.04'), null);
  assert.equal(parseSemver('v1.2.3'), null);
});

test('compareSemver follows release and prerelease precedence', () => {
  assert.equal(compareSemver('0.12.0', '0.11.9'), 1);
  assert.equal(compareSemver('1.0.0-next.2', '1.0.0-next.10'), -1);
  assert.equal(compareSemver('1.0.0-next.1', '1.0.0'), -1);
  assert.equal(compareSemver('1.0.0', '1.0.0+build.2'), 0);
});

test('current changelog helpers read the first release section', () => {
  const changelog = [
    '# Changelog',
    '',
    '## 0.12.0 - 2026-08-01',
    '',
    '### Minor Changes',
    '',
    '- Change.',
    '',
    '## 0.11.0',
    '',
    '- Previous change.',
  ].join('\n');

  assert.equal(currentChangelogVersion(changelog), '0.12.0');
  const entry = '### Minor Changes\n\n- Change.';
  assert.equal(currentChangelogEntry(changelog), entry);
  assert.equal(
    releaseBodyStartsWithCurrentChangelogEntry(`${entry}\n\n**npm:** package`, changelog),
    true,
  );
  assert.equal(
    releaseBodyStartsWithCurrentChangelogEntry('Rewritten summary.\n\n**npm:** package', changelog),
    false,
  );
  assert.equal(currentChangelogVersion('# Changelog\n'), null);
  assert.equal(currentChangelogEntry('# Changelog\n'), null);
});

test('release CLIs accept the pnpm argument separator', async () => {
  for (const script of ['create-release-tags.mjs', 'check-release-state.mjs']) {
    const result = await run(
      process.execPath,
      [join(repoRoot, 'tools', script), '--', '--help'],
      { cwd: repoRoot },
    );

    assert.match(result.stdout, /Usage:/);
  }
});
