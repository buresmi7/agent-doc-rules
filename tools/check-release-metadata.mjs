import { readdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import {
  currentChangelogVersion,
  loadReleaseMetadata,
  parseSemver,
  repoRoot,
} from './release-metadata.mjs';

const errors = [];
const metadata = await loadReleaseMetadata();
const rootPackage = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
const changesetConfig = JSON.parse(await readFile(join(repoRoot, '.changeset/config.json'), 'utf8'));

checkRootPackage();
checkChangesetConfig();
await checkPackageCoverage();
checkPackageEntries();
checkExistingTags();

if (errors.length > 0) {
  console.error('Release metadata check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Release metadata check passed for ${metadata.packages.length} public packages.`);

function checkRootPackage() {
  if (rootPackage.private !== true) {
    errors.push('The root package must remain private.');
  }

  if (metadata.packages.some((entry) => entry.name === rootPackage.name)) {
    errors.push('The private root package must not appear in release-packages.json.');
  }

  if (rootPackage.devDependencies?.['@changesets/cli'] !== '2.31.0') {
    errors.push('The root package must pin @changesets/cli to 2.31.0.');
  }
}

function checkChangesetConfig() {
  if (changesetConfig.changelog !== '@changesets/cli/changelog') {
    errors.push('.changeset/config.json must use the standard Changesets changelog writer.');
  }

  if (changesetConfig.commit !== false) {
    errors.push('Changesets must leave release commits to the maintainer.');
  }

  if (changesetConfig.access !== 'public') {
    errors.push('.changeset/config.json access must be public.');
  }

  if (changesetConfig.baseBranch !== 'master') {
    errors.push('.changeset/config.json baseBranch must be master.');
  }

  if (!Array.isArray(changesetConfig.fixed) || changesetConfig.fixed.length !== 0) {
    errors.push('.changeset/config.json fixed must stay empty for independent versions.');
  }

  if (!Array.isArray(changesetConfig.linked) || changesetConfig.linked.length !== 0) {
    errors.push('.changeset/config.json linked must stay empty for independent versions.');
  }

  if (changesetConfig.updateInternalDependencies !== 'patch') {
    errors.push('Changesets must use patch bumps for out-of-range internal dependencies.');
  }

  if (!Array.isArray(changesetConfig.ignore) || changesetConfig.ignore.length !== 0) {
    errors.push('.changeset/config.json ignore must stay empty.');
  }

  if (changesetConfig.privatePackages?.version !== false
    || changesetConfig.privatePackages?.tag !== false) {
    errors.push('Changesets must not version or tag private packages.');
  }
}

async function checkPackageCoverage() {
  const packagesDir = join(repoRoot, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const publicPackages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = join(packagesDir, entry.name, 'package.json');

    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

      if (manifest.private === false) {
        publicPackages.push(manifest.name);
      }
    } catch {
      // A package directory without a manifest is outside release metadata.
    }
  }

  const configured = new Set(metadata.packages.map((entry) => entry.name));

  for (const packageName of publicPackages) {
    if (!configured.has(packageName)) {
      errors.push(`${packageName} is public but missing from release-packages.json.`);
    }
  }

  for (const packageName of configured) {
    if (!publicPackages.includes(packageName)) {
      errors.push(`${packageName} is configured for release but is not a public workspace package.`);
    }
  }
}

function checkPackageEntries() {
  const names = new Set();
  const directories = new Set();
  const releaseTitles = new Set();
  const tagPrefixes = new Set();

  for (const entry of metadata.packages) {
    if (names.has(entry.name)) {
      errors.push(`Duplicate release package name: ${entry.name}.`);
    }
    names.add(entry.name);

    if (directories.has(entry.directory)) {
      errors.push(`Duplicate release package directory: ${entry.directory}.`);
    }
    directories.add(entry.directory);

    if (releaseTitles.has(entry.releaseTitle)) {
      errors.push(`Duplicate GitHub Release title: ${entry.releaseTitle}.`);
    }
    releaseTitles.add(entry.releaseTitle);

    if (tagPrefixes.has(entry.tagPrefix)) {
      errors.push(`Duplicate release tag prefix: ${entry.tagPrefix}.`);
    }
    tagPrefixes.add(entry.tagPrefix);

    if (entry.manifest.name !== entry.name) {
      errors.push(`${entry.directory}/package.json name must be ${entry.name}.`);
    }

    if (entry.manifest.private !== false) {
      errors.push(`${entry.name} must remain public.`);
    }

    if (!parseSemver(entry.version)) {
      errors.push(`${entry.name} has invalid SemVer ${entry.version}.`);
    }

    const changelogVersion = currentChangelogVersion(entry.changelog);

    if (changelogVersion !== entry.version) {
      errors.push(
        `${entry.directory}/CHANGELOG.md latest version ${changelogVersion ?? 'missing'}`
        + ` must match manifest version ${entry.version}.`,
      );
    }
  }
}

function checkExistingTags() {
  let tags;

  try {
    tags = execFileSync('git', ['tag', '--list'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);
  } catch (error) {
    errors.push(`Cannot inspect Git tags: ${error.message}`);
    return;
  }

  const legacyTags = new Set([
    'v0.1.0',
    'v0.1.1',
    'v0.1.2',
    'v0.1.3',
    'v0.1.4',
    'v0.1.5',
    'v0.1.6',
    'v0.2.0',
    'v0.3.0',
    'v0.4.0',
    'v0.5.0',
    'v0.6.0',
    'v0.7.0',
    'v0.8.0',
    'v0.8.1',
    'v0.8.2',
    'v0.9.0',
    'v0.10.0',
    'v0.11.0',
  ]);

  for (const tag of tags) {
    if (/^v\d+\.\d+\.\d+(?:[-+].+)?$/.test(tag) && !legacyTags.has(tag)) {
      errors.push(`Unqualified release tag ${tag} is not allowed after v0.11.0.`);
    }

    for (const entry of metadata.packages) {
      const prefix = `${entry.tagPrefix}@`;

      if (tag.startsWith(prefix) && !parseSemver(tag.slice(prefix.length))) {
        errors.push(`Package tag ${tag} has an invalid SemVer suffix.`);
      }
    }
  }
}
