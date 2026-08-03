import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export const defaultOutputDirectoryName = '.agent-e2e-output';

export async function createScenarioOutputDirectory({
  scenarioDir,
  outputRoot,
  projectFixtureDir,
  prefix = 'agent-e2e',
}) {
  if (outputRoot !== undefined && (
    typeof outputRoot !== 'string'
    || outputRoot.trim() === ''
  )) {
    throw new Error('outputRoot must be a non-empty path.');
  }

  const usesDefaultRoot = outputRoot === undefined;
  const resolvedProjectFixtureDir = projectFixtureDir
    ? resolve(projectFixtureDir)
    : null;
  let resolvedOutputRoot = resolve(
    outputRoot ?? join(scenarioDir, defaultOutputDirectoryName),
  );

  if (
    resolvedProjectFixtureDir
    && isPathInside(resolvedProjectFixtureDir, resolvedOutputRoot)
  ) {
    if (!usesDefaultRoot) {
      throw new Error('Agent E2E output root must be outside the fixture project.');
    }

    resolvedOutputRoot = resolve(
      dirname(resolvedProjectFixtureDir),
      defaultOutputDirectoryName,
      normalizeOutputPrefix(
        `${basename(resolvedProjectFixtureDir)}-${basename(resolve(scenarioDir))}`,
      ),
    );

    if (isPathInside(resolvedProjectFixtureDir, resolvedOutputRoot)) {
      throw new Error(
        'Could not place Agent E2E output outside the fixture project. Pass outputRoot explicitly.',
      );
    }
  }

  await mkdir(resolvedOutputRoot, { recursive: true });

  if (usesDefaultRoot) {
    await writeDefaultIgnoreFile(resolvedOutputRoot);
  }

  const outputDir = await mkdtemp(
    join(resolvedOutputRoot, `${normalizeOutputPrefix(prefix)}-`),
  );

  try {
    await Promise.all([
      writeFile(
        join(outputDir, '.npmrc'),
        'workspaces=false\n',
      ),
      writeFile(
        join(outputDir, 'package.json'),
        `${JSON.stringify({
          name: 'agent-e2e-run',
          private: true,
        }, null, 2)}\n`,
      ),
      writeFile(
        join(outputDir, 'pnpm-workspace.yaml'),
        'packages:\n  - project\n',
      ),
    ]);
  } catch (error) {
    await rm(outputDir, { recursive: true, force: true });
    throw error;
  }

  return {
    outputDir,
    outputRoot: resolvedOutputRoot,
  };
}

export async function removeScenarioOutputDirectory(outputDir) {
  await rm(outputDir, { recursive: true, force: true });
}

export function normalizeOutputPrefix(value) {
  const normalized = String(value)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);

  return normalized || 'agent-e2e';
}

async function writeDefaultIgnoreFile(outputRoot) {
  const path = join(outputRoot, '.gitignore');

  await writeFile(
    path,
    '# Generated agent-e2e-runner output\n*\n',
    { flag: 'wx' },
  ).catch((error) => {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  });
}

function isPathInside(parent, child) {
  const rel = relative(parent, child);

  return rel === '' || (
    rel !== '..'
    && !rel.startsWith(`..${sep}`)
    && !isAbsolute(rel)
  );
}
