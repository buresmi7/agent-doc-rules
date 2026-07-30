import { execFile } from 'node:child_process';

import {
  compareSemver,
  currentChangelogVersion,
  findReleasePackage,
  loadReleaseMetadata,
  packageNpmUrl,
  packageReleaseTitle,
  parseSemver,
  releaseBodyStartsWithCurrentChangelogEntry,
  repoRoot,
} from './release-metadata.mjs';

const options = parseArguments(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const metadata = await loadReleaseMetadata();
const selected = selectPackages(metadata, options.packages);
const errors = [];
const results = [];

for (const entry of selected) {
  await checkPackage(entry, metadata.repository, options.phase);
}

if (errors.length > 0) {
  console.error(`Release ${options.phase} check failed:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Release ${options.phase} check passed:`);
for (const result of results) {
  console.log(`- ${result}`);
}

async function checkPackage(entry, repository, phase) {
  if (!parseSemver(entry.version)) {
    errors.push(`${entry.name} has invalid SemVer ${entry.version}.`);
    return;
  }

  if (currentChangelogVersion(entry.changelog) !== entry.version) {
    errors.push(`${entry.directory}/CHANGELOG.md does not start with ${entry.version}.`);
    return;
  }

  let npmExact;
  let npmLatest;
  let localTag;
  let remoteTag;
  let release;

  try {
    [npmExact, npmLatest, localTag, remoteTag, release] = await Promise.all([
      npmVersion(entry.name, entry.version),
      npmVersion(entry.name),
      localTagState(entry.tag),
      remoteTagState(entry.tag),
      releaseState(repository, entry.tag),
    ]);
  } catch (error) {
    errors.push(`${entry.name}: ${error.message}`);
    return;
  }

  if (phase === 'prepared' || phase === 'tagged') {
    if (npmExact !== null) {
      errors.push(`${entry.name}@${entry.version} already exists on npm.`);
    }

    if (npmLatest === null
      || !parseSemver(npmLatest)
      || compareSemver(entry.version, npmLatest) <= 0) {
      errors.push(
        `${entry.name} manifest version ${entry.version} must be newer than npm latest`
        + ` ${npmLatest ?? 'missing'}.`,
      );
    }
  }

  if (phase === 'prepared') {
    if (localTag !== null) {
      errors.push(`${entry.tag} already exists locally.`);
    }

    if (remoteTag !== null) {
      errors.push(`${entry.tag} already exists on origin.`);
    }

    if (release !== null) {
      errors.push(`GitHub Release ${entry.tag} already exists.`);
    }
  }

  if (phase === 'tagged' || phase === 'published') {
    if (localTag === null) {
      errors.push(`${entry.tag} is missing locally.`);
    }

    if (remoteTag === null) {
      errors.push(`${entry.tag} is missing on origin.`);
    }

    if (localTag !== null && remoteTag !== null && localTag.object !== remoteTag.object) {
      errors.push(`${entry.tag} differs between the local repository and origin.`);
    }

    if (localTag !== null && localTag.type !== 'tag') {
      errors.push(`${entry.tag} must be an annotated tag.`);
    }

    if (phase === 'tagged' && localTag !== null) {
      try {
        if (localTag.commit !== await headCommit()) {
          errors.push(`${entry.tag} must point to the checked-out release commit.`);
        }
      } catch (error) {
        errors.push(`${entry.name}: ${error.message}`);
      }
    }

    if (localTag !== null) {
      await checkTaggedPackage(entry);
    }
  }

  if (phase === 'tagged' && release !== null) {
    errors.push(`GitHub Release ${entry.tag} exists before npm publication.`);
  }

  if (phase === 'published') {
    if (npmExact !== entry.version) {
      errors.push(`${entry.name}@${entry.version} is missing from npm.`);
    }

    if (release === null) {
      errors.push(`GitHub Release ${entry.tag} is missing.`);
    } else {
      if (release.tagName !== entry.tag) {
        errors.push(`GitHub Release tag must be ${entry.tag}.`);
      }

      const expectedTitle = packageReleaseTitle(entry);

      if (release.name !== expectedTitle) {
        errors.push(
          `GitHub Release title for ${entry.tag} must be ${expectedTitle}.`,
        );
      }

      if (release.isDraft || release.isPrerelease) {
        errors.push(`GitHub Release ${entry.tag} must be a final published Release.`);
      }

      const changelogLink = `/blob/${entry.tag}/${entry.directory}/CHANGELOG.md`;
      const npmLink = packageNpmUrl(entry);

      if (!release.body.includes(changelogLink)) {
        errors.push(`GitHub Release ${entry.tag} must link to its tagged package changelog.`);
      }

      if (!releaseBodyStartsWithCurrentChangelogEntry(release.body, entry.changelog)) {
        errors.push(
          `GitHub Release ${entry.tag} must start with its current package changelog entry.`,
        );
      }

      if (!release.body.includes(npmLink)) {
        errors.push(`GitHub Release ${entry.tag} must link to ${entry.name}@${entry.version} on npm.`);
      }
    }
  }

  results.push(`${entry.name} ${entry.version} (${entry.tag})`);
}

async function checkTaggedPackage(entry) {
  const result = await run('git', ['show', `${entry.tag}:${entry.directory}/package.json`]);

  if (result.code !== 0) {
    errors.push(`${entry.tag} does not contain ${entry.directory}/package.json.`);
    return;
  }

  try {
    const taggedManifest = JSON.parse(result.stdout);

    if (taggedManifest.name !== entry.name || taggedManifest.version !== entry.version) {
      errors.push(`${entry.tag} package manifest does not match ${entry.name} ${entry.version}.`);
    }
  } catch {
    errors.push(`${entry.tag} contains an invalid package manifest.`);
  }
}

async function npmVersion(packageName, version) {
  const specifier = version ? `${packageName}@${version}` : packageName;
  const result = await run('npm', ['view', specifier, 'version', '--json']);

  if (result.code === 0) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error(`npm returned invalid version data for ${specifier}.`);
    }
  }

  const output = `${result.stderr}\n${result.stdout}`;

  if (/\bE404\b|is not in this registry/i.test(output)) {
    return null;
  }

  throw new Error(`npm lookup failed for ${specifier}: ${compact(output)}`);
}

async function localTagState(tag) {
  const objectResult = await run(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`],
  );

  if (objectResult.code === 1) {
    return null;
  }

  if (objectResult.code !== 0) {
    throw new Error(`cannot inspect local tag ${tag}: ${compact(objectResult.stderr)}`);
  }

  const [commitResult, typeResult] = await Promise.all([
    run('git', ['rev-parse', `${tag}^{}`]),
    run('git', ['cat-file', '-t', `refs/tags/${tag}`]),
  ]);

  if (commitResult.code !== 0) {
    throw new Error(`cannot resolve local tag ${tag}: ${compact(commitResult.stderr)}`);
  }

  if (typeResult.code !== 0) {
    throw new Error(`cannot inspect local tag type for ${tag}: ${compact(typeResult.stderr)}`);
  }

  return {
    object: objectResult.stdout.trim(),
    commit: commitResult.stdout.trim(),
    type: typeResult.stdout.trim(),
  };
}

async function remoteTagState(tag) {
  const result = await run(
    'git',
    ['ls-remote', '--tags', '--refs', 'origin', `refs/tags/${tag}`],
  );

  if (result.code !== 0) {
    throw new Error(`cannot inspect origin tag ${tag}: ${compact(result.stderr)}`);
  }

  const output = result.stdout.trim();

  if (!output) {
    return null;
  }

  return {
    object: output.split(/\s+/)[0],
  };
}

async function releaseState(repository, tag) {
  const result = await run(
    'gh',
    [
      'release',
      'view',
      tag,
      '--repo',
      repository,
      '--json',
      'name,tagName,isDraft,isPrerelease,body,url',
    ],
  );

  if (result.code === 0) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new Error(`GitHub returned invalid Release data for ${tag}.`);
    }
  }

  const output = `${result.stderr}\n${result.stdout}`;

  if (/release not found|no release found with tag/i.test(output)) {
    return null;
  }

  throw new Error(`GitHub Release lookup failed for ${tag}: ${compact(output)}`);
}

async function headCommit() {
  const result = await run('git', ['rev-parse', 'HEAD']);

  if (result.code !== 0) {
    throw new Error(`cannot resolve HEAD: ${compact(result.stderr)}`);
  }

  return result.stdout.trim();
}

function run(command, args) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          code: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
        });
      },
    );
  });
}

function parseArguments(args) {
  const parsed = {
    help: false,
    packages: [],
    phase: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--') {
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }

    if (argument === '--phase') {
      parsed.phase = args[index + 1];
      index += 1;
      continue;
    }

    if (argument === '--package') {
      const selector = args[index + 1];

      if (!selector || selector.startsWith('--')) {
        fail('--package requires a package name, tag prefix, or directory.');
      }

      parsed.packages.push(selector);
      index += 1;
      continue;
    }

    fail(`Unknown argument: ${argument}`);
  }

  if (!parsed.help && !['prepared', 'tagged', 'published'].includes(parsed.phase)) {
    fail('--phase must be prepared, tagged, or published.');
  }

  if (!parsed.help && parsed.packages.some((selector) => !selector)) {
    fail('--package requires a package name, tag prefix, or directory.');
  }

  return parsed;
}

function selectPackages(metadata, selectors) {
  if (selectors.length === 0) {
    fail('Select at least one package with --package.');
  }

  const selected = [];
  const names = new Set();

  for (const selector of selectors) {
    const entry = findReleasePackage(metadata, selector);

    if (!entry) {
      fail(`Unknown release package: ${selector}`);
    }

    if (names.has(entry.name)) {
      fail(`Package selected more than once: ${entry.name}`);
    }

    names.add(entry.name);
    selected.push(entry);
  }

  return selected;
}

function compact(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function printHelp() {
  console.log(`Usage:
  corepack pnpm run release:check -- --phase PHASE --package PACKAGE

PHASE is prepared, tagged, or published. Repeat --package to check several
packages. PACKAGE may be an npm package name, tag prefix, or configured package
directory.`);
}

function fail(message) {
  console.error(`Release state check failed: ${message}`);
  process.exit(1);
}
