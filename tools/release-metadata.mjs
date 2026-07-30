import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export async function loadReleaseMetadata(root = repoRoot) {
  const metadataPath = join(root, 'release-packages.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));

  if (typeof metadata.repository !== 'string'
    || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(metadata.repository)) {
    throw new Error('release-packages.json repository must use OWNER/REPOSITORY.');
  }

  if (!Array.isArray(metadata.packages) || metadata.packages.length === 0) {
    throw new Error('release-packages.json packages must be a non-empty array.');
  }

  const packages = [];

  for (const entry of metadata.packages) {
    validateEntry(entry);

    const manifestPath = join(root, entry.directory, 'package.json');
    const changelogPath = join(root, entry.directory, 'CHANGELOG.md');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const changelog = await readFile(changelogPath, 'utf8');

    packages.push({
      ...entry,
      manifest,
      changelog,
      manifestPath,
      changelogPath,
      version: manifest.version,
      tag: `${entry.tagPrefix}@${manifest.version}`,
    });
  }

  return {
    repository: metadata.repository,
    packages,
  };
}

export function findReleasePackage(metadata, selector) {
  return metadata.packages.find((entry) => (
    entry.name === selector
    || entry.tagPrefix === selector
    || entry.directory === selector
  ));
}

export function packageReleaseTitle(entry) {
  return `${entry.releaseTitle} ${entry.version}`;
}

export function packageNpmUrl(entry) {
  return `https://www.npmjs.com/package/${entry.name}/v/${entry.version}`;
}

export function parseSemver(version) {
  const match = semverPattern.exec(version);

  if (!match) {
    return null;
  }

  const prerelease = match[4]?.split('.') ?? [];

  if (prerelease.some((identifier) => (
    /^\d+$/.test(identifier)
    && identifier.length > 1
    && identifier.startsWith('0')
  ))) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  };
}

export function compareSemver(left, right) {
  const leftVersion = parseSemver(left);
  const rightVersion = parseSemver(right);

  if (!leftVersion || !rightVersion) {
    throw new Error(`Cannot compare invalid SemVer values: ${left} and ${right}.`);
  }

  for (const key of ['major', 'minor', 'patch']) {
    if (leftVersion[key] !== rightVersion[key]) {
      return leftVersion[key] > rightVersion[key] ? 1 : -1;
    }
  }

  const leftPre = leftVersion.prerelease;
  const rightPre = rightVersion.prerelease;

  if (leftPre.length === 0 || rightPre.length === 0) {
    if (leftPre.length === rightPre.length) {
      return 0;
    }

    return leftPre.length === 0 ? 1 : -1;
  }

  const length = Math.max(leftPre.length, rightPre.length);

  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftPre[index];
    const rightIdentifier = rightPre[index];

    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === undefined ? -1 : 1;
    }

    if (leftIdentifier === rightIdentifier) {
      continue;
    }

    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);

    if (leftNumeric && rightNumeric) {
      return Number(leftIdentifier) > Number(rightIdentifier) ? 1 : -1;
    }

    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }

    return leftIdentifier > rightIdentifier ? 1 : -1;
  }

  return 0;
}

export function currentChangelogVersion(changelog) {
  const match = changelog.match(/^##\s+([^\s]+)(?:\s+-\s+.+)?$/m);
  return match?.[1] ?? null;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('Each release package entry must be an object.');
  }

  if (typeof entry.name !== 'string'
    || !/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(entry.name)) {
    throw new Error('Each release package name must be a scoped npm package name.');
  }

  if (typeof entry.directory !== 'string'
    || isAbsolute(entry.directory)
    || normalize(entry.directory) !== entry.directory
    || normalize(entry.directory).startsWith('..')) {
    throw new Error(`Invalid release package directory for ${entry.name ?? 'unknown package'}.`);
  }

  if (typeof entry.releaseTitle !== 'string'
    || entry.releaseTitle.trim() !== entry.releaseTitle
    || entry.releaseTitle.length === 0
    || /[\r\n]/.test(entry.releaseTitle)) {
    throw new Error(`Invalid GitHub Release title for ${entry.name}.`);
  }

  if (typeof entry.tagPrefix !== 'string'
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.tagPrefix)) {
    throw new Error(`Invalid release tag prefix for ${entry.name}.`);
  }
}
