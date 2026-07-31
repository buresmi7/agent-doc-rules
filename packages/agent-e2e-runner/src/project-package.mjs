import {
  access,
  cp,
  mkdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './process.mjs';

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
];
const localDependencyFields = [
  ...dependencyFields,
  'peerDependencies',
];

const packageManagerLockFiles = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
];

const generatedLockFiles = packageManagerLockFiles.map(([file]) => file);

export async function readProjectSkillDefinition(projectDir, selectedSkill) {
  const { manifest } = await readPackageManifest(projectDir);

  if (
    !selectedSkill
    || typeof selectedSkill !== 'object'
    || Array.isArray(selectedSkill)
  ) {
    throw new Error(
      'Agent scenarios require a skill object with packageName and name.',
    );
  }

  const packageName = readRequiredString(
    selectedSkill.packageName,
    'skill.packageName',
  );
  const name = readRequiredString(selectedSkill.name, 'skill.name');

  assertKnownSkillProperties(selectedSkill);
  assertPackageName(packageName);
  assertSkillName(name);

  const dependency = findDependency(manifest, packageName);

  if (!dependency) {
    throw new Error(
      `Agent E2E skill package ${packageName} must be listed in project/package.json dependencies, devDependencies, or optionalDependencies.`,
    );
  }

  return {
    name,
    packageName,
    packageSpec: dependency.spec,
    installedSkillPath: `.agents/skills/${name}/SKILL.md`,
  };
}

export async function installProjectDependencies({
  projectDir,
  projectFixtureDir,
  repoRoot = projectFixtureDir,
  skill,
  baseEnv = process.env,
  run = runCommand,
}) {
  const { content, manifest } = await readPackageManifest(projectDir);
  const normalizedManifest = structuredClone(manifest);
  const packageManager = await detectPackageManager({
    projectFixtureDir,
    repoRoot,
  });

  if (packageManager.declaration && !normalizedManifest.packageManager) {
    normalizedManifest.packageManager = packageManager.declaration;
  }

  await normalizeLocalDependencies(normalizedManifest, {
    projectFixtureDir,
    repoRoot,
    localPackages: {
      root: join(dirname(projectDir), 'local-packages'),
      sources: new Map(),
      nextIndex: 1,
    },
  });

  const lockState = await captureFiles(projectDir, generatedLockFiles);

  try {
    await writeFile(
      join(projectDir, 'package.json'),
      `${JSON.stringify(normalizedManifest, null, 2)}\n`,
    );

    const invocation = packageManagerInvocation(packageManager.name);
    await run(invocation.command, invocation.args, '', {
      cwd: projectDir,
      env: {
        ...baseEnv,
        NO_COLOR: '1',
        YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
      },
    });
  } finally {
    await writeFile(join(projectDir, 'package.json'), content);
    await restoreFiles(projectDir, lockState);
  }

  return {
    packageManager: packageManager.name,
    skillSource: await resolvePackageSource(skill.packageName, projectDir),
  };
}

async function readPackageManifest(projectDir) {
  const packagePath = join(projectDir, 'package.json');
  let content;

  try {
    content = await readFile(packagePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Agent scenario project is missing package.json: ${packagePath}`);
    }

    throw error;
  }

  let manifest;

  try {
    manifest = JSON.parse(content);
  } catch (error) {
    throw new Error(`Agent scenario project has invalid package.json: ${packagePath}`, {
      cause: error,
    });
  }

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`Agent scenario project has invalid package.json: ${packagePath}`);
  }

  return { content, manifest };
}

function readRequiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Agent scenario requires a non-empty ${field}.`);
  }

  return value;
}

function assertKnownSkillProperties(configured) {
  const unknownProperties = Object.keys(configured).filter(
    (property) => !['packageName', 'name'].includes(property),
  );

  if (unknownProperties.length > 0) {
    throw new Error(
      `Unknown skill properties: ${unknownProperties.join(', ')}.`,
    );
  }
}

function assertPackageName(packageName) {
  const segments = packageName.startsWith('@')
    ? packageName.slice(1).split('/')
    : [packageName];
  const validSegment = /^[a-z0-9][a-z0-9._-]*$/;

  if (
    segments.length !== (packageName.startsWith('@') ? 2 : 1)
    || segments.some((segment) => !validSegment.test(segment))
  ) {
    throw new Error(`Invalid skill.packageName: ${packageName}`);
  }
}

function assertSkillName(name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    throw new Error(
      'skill.name must use 1-64 lowercase letters, numbers, and single hyphens.',
    );
  }
}

function findDependency(manifest, packageName) {
  for (const field of dependencyFields) {
    const spec = manifest[field]?.[packageName];

    if (typeof spec === 'string' && spec.trim() !== '') {
      return { field, spec };
    }
  }

  return null;
}

async function normalizeLocalDependencies(manifest, {
  projectFixtureDir,
  repoRoot,
  localPackages,
}) {
  for (const field of localDependencyFields) {
    const dependencies = manifest[field];

    if (!dependencies || typeof dependencies !== 'object') {
      continue;
    }

    for (const [packageName, spec] of Object.entries(dependencies)) {
      dependencies[packageName] = await normalizeDependencySpec({
        packageName,
        spec,
        projectFixtureDir,
        repoRoot,
        localPackages,
      });
    }
  }
}

async function normalizeDependencySpec({
  packageName,
  spec,
  projectFixtureDir,
  repoRoot,
  localPackages,
}) {
  if (typeof spec !== 'string') {
    return spec;
  }

  if (spec.startsWith('workspace:')) {
    const source = await resolvePackageSource(packageName, projectFixtureDir, repoRoot);
    return `file:${await materializeLocalPackage(source, {
      repoRoot,
      localPackages,
    })}`;
  }

  for (const protocol of ['file:', 'link:', 'portal:']) {
    if (spec.startsWith(protocol)) {
      const source = resolveLocalPath(
        projectFixtureDir,
        spec.slice(protocol.length),
        spec,
      );

      return `file:${await materializeLocalPackageIfDirectory(source, {
        repoRoot,
        localPackages,
      })}`;
    }
  }

  if (spec.startsWith('.') || isAbsolute(spec)) {
    const source = resolveLocalPath(projectFixtureDir, spec, spec);

    return `file:${await materializeLocalPackageIfDirectory(source, {
      repoRoot,
      localPackages,
    })}`;
  }

  return spec;
}

async function materializeLocalPackageIfDirectory(source, context) {
  const sourceStat = await stat(source).catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  return sourceStat?.isDirectory()
    ? materializeLocalPackage(source, context)
    : source;
}

async function materializeLocalPackage(source, {
  repoRoot,
  localPackages,
}) {
  const resolvedSource = await realpath(source);
  const existing = localPackages.sources.get(resolvedSource);

  if (existing) {
    return existing;
  }

  const { content, manifest } = await readPackageManifest(resolvedSource);
  const packageLabel = normalizePackageDirectoryName(
    manifest.name ?? basename(resolvedSource),
  );
  const target = join(
    localPackages.root,
    `${String(localPackages.nextIndex).padStart(2, '0')}-${packageLabel}`,
  );

  localPackages.nextIndex += 1;
  localPackages.sources.set(resolvedSource, target);

  await mkdir(localPackages.root, { recursive: true });
  await cp(resolvedSource, target, {
    recursive: true,
    filter: (path) => !['.git', 'node_modules'].includes(basename(path)),
  });

  const normalizedManifest = structuredClone(manifest);

  await normalizeLocalDependencies(normalizedManifest, {
    projectFixtureDir: resolvedSource,
    repoRoot,
    localPackages,
  });

  const normalizedContent = `${JSON.stringify(normalizedManifest, null, 2)}\n`;

  if (normalizedContent !== content) {
    await writeFile(join(target, 'package.json'), normalizedContent);
  }

  return target;
}

function normalizePackageDirectoryName(value) {
  return String(value)
    .replace(/^@/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    || 'package';
}

function resolveLocalPath(projectFixtureDir, value, originalSpec) {
  if (originalSpec.startsWith('file://')) {
    return fileURLToPath(originalSpec);
  }

  return isAbsolute(value) ? value : resolve(projectFixtureDir, value);
}

async function resolvePackageSource(packageName, ...projectDirs) {
  let lastError;

  for (const projectDir of projectDirs) {
    if (!projectDir) {
      continue;
    }

    const packagePath = join(projectDir, 'node_modules', packageName, 'package.json');

    try {
      const resolvedPackagePath = await realpath(packagePath);
      const manifest = JSON.parse(await readFile(resolvedPackagePath, 'utf8'));

      if (manifest.name === packageName) {
        return dirname(resolvedPackagePath);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        lastError = error;
      }
    }

    const requireFromProject = createRequire(resolve(projectDir, 'package.json'));

    try {
      return dirname(requireFromProject.resolve(`${packageName}/package.json`));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Cannot resolve Agent E2E dependency ${packageName}. Install the test project's dependencies before running workspace-based scenarios.`,
    { cause: lastError },
  );
}

async function detectPackageManager({ projectFixtureDir, repoRoot }) {
  const projectManifest = (await readPackageManifest(projectFixtureDir)).manifest;
  const projectManager = parsePackageManager(projectManifest.packageManager);

  if (projectManager) {
    return projectManager;
  }

  const projectLockManager = await detectLockManager(projectFixtureDir);

  if (projectLockManager) {
    return projectLockManager;
  }

  if (repoRoot && resolve(repoRoot) !== resolve(projectFixtureDir)) {
    const rootManifest = await readOptionalPackageManifest(repoRoot);
    const rootManager = parsePackageManager(rootManifest?.packageManager);

    if (rootManager) {
      return rootManager;
    }

    const rootLockManager = await detectLockManager(repoRoot);

    if (rootLockManager) {
      return rootLockManager;
    }
  }

  return { name: 'npm' };
}

async function readOptionalPackageManifest(projectDir) {
  try {
    return (await readPackageManifest(projectDir)).manifest;
  } catch (error) {
    if (error.message.startsWith('Agent scenario project is missing package.json:')) {
      return null;
    }

    throw error;
  }
}

function parsePackageManager(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const name = value.split('@', 1)[0];

  if (!['npm', 'pnpm', 'yarn', 'bun'].includes(name)) {
    throw new Error(`Unsupported package manager in packageManager: ${value}`);
  }

  return {
    name,
    declaration: value,
  };
}

async function detectLockManager(projectDir) {
  for (const [file, packageManager] of packageManagerLockFiles) {
    try {
      await access(join(projectDir, file));
      return { name: packageManager };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return null;
}

function packageManagerInvocation(packageManager) {
  switch (packageManager) {
    case 'npm':
      return {
        command: 'npm',
        args: ['install', '--no-audit', '--no-fund'],
      };
    case 'pnpm':
      return {
        command: 'corepack',
        args: ['pnpm', 'install', '--no-frozen-lockfile'],
      };
    case 'yarn':
      return {
        command: 'corepack',
        args: ['yarn', 'install'],
      };
    case 'bun':
      return {
        command: 'bun',
        args: ['install'],
      };
    default:
      throw new Error(`Unsupported package manager: ${packageManager}`);
  }
}

async function captureFiles(projectDir, fileNames) {
  const state = new Map();

  for (const fileName of fileNames) {
    try {
      state.set(fileName, await readFile(join(projectDir, fileName)));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      state.set(fileName, null);
    }
  }

  return state;
}

async function restoreFiles(projectDir, state) {
  for (const [fileName, content] of state) {
    const path = join(projectDir, fileName);

    if (content === null) {
      await rm(path, { force: true });
    } else {
      await writeFile(path, content);
    }
  }
}
