import { execFileSync, spawnSync } from 'node:child_process';

import {
  compareSemver,
  currentChangelogVersion,
  findReleasePackage,
  loadReleaseMetadata,
  parseSemver,
  repoRoot,
} from './release-metadata.mjs';

const options = parseArguments(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const metadata = await loadReleaseMetadata();
const selected = selectPackages(metadata, options.packages);

preflight(selected);

console.log('Release tags:');
for (const entry of selected) {
  console.log(`- ${entry.tag} (${entry.name} ${entry.version})`);
}

if (!options.write) {
  console.log('');
  console.log('Dry run only. Add --write after the release commit is pushed and verified.');
  process.exit(0);
}

assertCleanWorktree();
assertPushedHead();

for (const entry of selected) {
  execFileSync(
    'git',
    ['tag', '-a', entry.tag, '-m', `${entry.name} ${entry.version}`],
    { cwd: repoRoot, stdio: 'inherit' },
  );
}

console.log('');
console.log(`Created ${selected.length} annotated package tag${selected.length === 1 ? '' : 's'}.`);
console.log(`Push with: git push origin --atomic ${selected.map((entry) => entry.tag).join(' ')}`);

function parseArguments(args) {
  const parsed = {
    help: false,
    packages: [],
    write: false,
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

    if (argument === '--write') {
      parsed.write = true;
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

function preflight(packages) {
  for (const entry of packages) {
    if (!parseSemver(entry.version)) {
      fail(`${entry.name} has invalid SemVer ${entry.version}.`);
    }

    if (currentChangelogVersion(entry.changelog) !== entry.version) {
      fail(`${entry.directory}/CHANGELOG.md does not start with ${entry.version}.`);
    }

    assertUnpublishedVersion(entry);

    if (localTagExists(entry.tag)) {
      fail(`Local tag already exists: ${entry.tag}`);
    }

    if (remoteTagExists(entry.tag)) {
      fail(`Remote tag already exists: ${entry.tag}`);
    }
  }
}

function assertUnpublishedVersion(entry) {
  const exact = spawnSync(
    'npm',
    ['view', `${entry.name}@${entry.version}`, 'version', '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (exact.error) {
    fail(`Cannot inspect ${entry.name}@${entry.version} on npm: ${exact.error.message}`);
  }

  if (exact.status === 0) {
    fail(`${entry.name}@${entry.version} already exists on npm.`);
  } else {
    const output = `${exact.stderr ?? ''}\n${exact.stdout ?? ''}`;

    if (!/\bE404\b|is not in this registry/i.test(output)) {
      fail(`Cannot inspect ${entry.name}@${entry.version} on npm: ${compact(output)}`);
    }
  }

  const latestResult = spawnSync(
    'npm',
    ['view', entry.name, 'version', '--json'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  if (latestResult.error || latestResult.status !== 0) {
    const output = `${latestResult.stderr ?? ''}\n${latestResult.stdout ?? ''}`;

    if (!latestResult.error && isNpmNotFound(output)) {
      return;
    }

    fail(
      `Cannot inspect npm latest for ${entry.name}:`
      + ` ${compact(output) || latestResult.error?.message}`,
    );
  }

  let latest;

  try {
    latest = JSON.parse(latestResult.stdout);
  } catch {
    fail(`npm returned invalid latest-version data for ${entry.name}.`);
  }

  if (compareSemver(entry.version, latest) <= 0) {
    fail(`${entry.name} version ${entry.version} must be newer than npm latest ${latest}.`);
  }
}

function isNpmNotFound(output) {
  return /\bE404\b|is not in this registry/i.test(output);
}

function localTagExists(tag) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch (error) {
    if (error.status === 1) {
      return false;
    }
    throw error;
  }
}

function remoteTagExists(tag) {
  try {
    const output = execFileSync(
      'git',
      ['ls-remote', '--tags', '--refs', 'origin', `refs/tags/${tag}`],
      { cwd: repoRoot, encoding: 'utf8' },
    );
    return output.trim().length > 0;
  } catch (error) {
    fail(`Cannot inspect origin for ${tag}: ${error.message}`);
  }
}

function assertCleanWorktree() {
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (status.trim()) {
    fail('Commit all release changes before creating package tags.');
  }
}

function assertPushedHead() {
  let head;
  let upstream;

  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
    upstream = execFileSync('git', ['rev-parse', '@{upstream}'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch (error) {
    fail(`Cannot compare the release commit with its upstream: ${error.message}`);
  }

  if (head !== upstream) {
    fail('Push the release commit before creating package tags.');
  }
}

function printHelp() {
  console.log(`Usage:
  corepack pnpm run release:tag -- --package PACKAGE [--package PACKAGE] [--write]

Without --write, print the exact tags without changing Git. PACKAGE may be an
npm package name, tag prefix, or configured package directory.`);
}

function compact(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function fail(message) {
  console.error(`Release tag preparation failed: ${message}`);
  process.exit(1);
}
