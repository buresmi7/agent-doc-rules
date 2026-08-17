#!/usr/bin/env node
import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
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
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(packageRoot, 'skills');
const defaultTarget = join(process.cwd(), '.agents', 'skills');

if (await isDirectExecution()) {
  await main().catch((error) => {
    console.error(`agent-doc-rules-skill: ${error.message}`);
    process.exit(1);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const skillNames = validateSkillNames(packageJson.agentDocRules?.localSkills);
  const projectRoot = await realpath(process.cwd());
  const requestedTarget = resolve(process.cwd(), options.target ?? defaultTarget);
  assertSkillsDirectoryTarget(requestedTarget);
  let target = await resolveContainedTarget(requestedTarget, projectRoot);
  await validateSources(skillNames);

  const existingRoot = await pathInfo(target);

  if (existingRoot && !existingRoot.isDirectory()) {
    throw new Error(`Skills target exists but is not a directory: ${target}`);
  }

  const conflicts = [];

  for (const skillName of skillNames) {
    if (await pathEntry(join(target, skillName))) {
      conflicts.push(skillName);
    }
  }

  if (conflicts.length > 0 && !options.force) {
    throw new Error(
      `Skill target already exists: ${conflicts.join(', ')}\n` +
      'Re-run with --force to replace only these owned skills.',
    );
  }

  if (options.dryRun) {
    console.log(
      `Would install ${packageJson.name}@${packageJson.version} skills ` +
      `${skillNames.join(', ')} to ${requestedTarget}`,
    );
    return;
  }

  await mkdir(target, { recursive: true });
  const verifiedTarget = await resolveContainedTarget(requestedTarget, projectRoot);

  if (verifiedTarget !== target) {
    throw new Error(`Skills target changed while preparing the installation: ${requestedTarget}`);
  }

  target = verifiedTarget;
  const { cleanupWarning } = await installTransaction({ conflicts, skillNames, target });

  if (cleanupWarning) {
    console.warn(`agent-doc-rules-skill: ${cleanupWarning}`);
  }

  console.log(
    `Installed ${packageJson.name}@${packageJson.version} skills ` +
    `${skillNames.join(', ')} to ${requestedTarget}`,
  );
}

export async function installTransaction({
  conflicts,
  skillNames,
  target,
  source = sourceRoot,
  operations = {},
}) {
  const fs = {
    cp,
    mkdir,
    mkdtemp,
    rename,
    rm,
    ...operations,
  };
  const transactionRoot = await fs.mkdtemp(join(target, '.agent-doc-rules-install-'));
  const stagedRoot = join(transactionRoot, 'staged');
  const backupRoot = join(transactionRoot, 'backup');
  const installed = [];
  const backedUp = [];

  try {
    await fs.mkdir(stagedRoot);
    await fs.mkdir(backupRoot);

    for (const skillName of skillNames) {
      await fs.cp(join(source, skillName), join(stagedRoot, skillName), {
        recursive: true,
      });
    }

    for (const skillName of conflicts) {
      await fs.rename(join(target, skillName), join(backupRoot, skillName));
      backedUp.push(skillName);
    }

    for (const skillName of skillNames) {
      await fs.rename(join(stagedRoot, skillName), join(target, skillName));
      installed.push(skillName);
    }
  } catch (error) {
    const rollbackErrors = [];

    for (const skillName of [...installed].reverse()) {
      await attemptRollback(
        () => fs.rm(join(target, skillName), { recursive: true, force: true }),
        `remove newly installed ${skillName}`,
        rollbackErrors,
      );
    }

    for (const skillName of [...backedUp].reverse()) {
      await attemptRollback(
        () => fs.rename(join(backupRoot, skillName), join(target, skillName)),
        `restore backup for ${skillName}`,
        rollbackErrors,
      );
    }

    if (rollbackErrors.length > 0) {
      throw new Error([
        `Installation failed: ${error.message}`,
        'Rollback was incomplete:',
        ...rollbackErrors.map((rollbackError) => `- ${rollbackError}`),
        `Transaction retained at ${transactionRoot}.`,
        `Recover remaining backups from ${backupRoot} before retrying.`,
      ].join('\n'));
    }

    const cleanupError = await removeTransaction(fs, transactionRoot);

    if (cleanupError) {
      throw new Error([
        `Installation failed and was rolled back: ${error.message}`,
        `Rollback succeeded, but transaction cleanup failed: ${cleanupError.message}`,
        `Transaction may remain at ${transactionRoot}; remove it manually.`,
      ].join('\n'));
    }

    throw new Error(`Installation failed and was rolled back: ${error.message}`);
  }

  const cleanupError = await removeTransaction(fs, transactionRoot);

  return {
    cleanupWarning: cleanupError
      ? [
        `Installation completed, but transaction cleanup failed: ${cleanupError.message}`,
        `Installed skills are active. Transaction data may remain at ${transactionRoot}; ` +
          'remove it manually after verifying the installation.',
      ].join('\n')
      : undefined,
  };
}

async function attemptRollback(action, description, errors) {
  try {
    await action();
  } catch (error) {
    errors.push(`${description}: ${error.message}`);
  }
}

async function removeTransaction(fs, transactionRoot) {
  try {
    await fs.rm(transactionRoot, { recursive: true, force: true });
    return undefined;
  } catch (error) {
    return error;
  }
}

async function validateSources(skillNames) {
  for (const skillName of skillNames) {
    const source = await pathInfo(join(sourceRoot, skillName, 'SKILL.md'));

    if (!source?.isFile()) {
      throw new Error(`Published skill is missing SKILL.md: ${skillName}`);
    }
  }
}

export function validateSkillNames(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('package.json must declare agentDocRules.localSkills.');
  }

  const names = [...new Set(value)];

  if (names.length !== value.length || names.some((name) => (
    typeof name !== 'string'
    || basename(name) !== name
    || !/^[a-z0-9][a-z0-9-]*$/.test(name)
  ))) {
    throw new Error('agentDocRules.localSkills must contain unique directory names.');
  }

  return names;
}

async function pathInfo(path) {
  return stat(path).catch((error) => {
    if (error?.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  });
}

async function pathEntry(path) {
  return lstat(path).catch((error) => {
    if (error?.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  });
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    dryRun: false,
    force: false,
    help: false,
    target: undefined,
  };

  if (args[0] === 'install') {
    args.shift();
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--target' || arg === '-t') {
      const value = args[index + 1];

      if (!value || value.trim() === '') {
        throw new Error(`${arg} requires a path value`);
      }

      options.target = value;
      index += 1;
    } else if (arg.startsWith('--target=')) {
      const value = arg.slice('--target='.length);

      if (value.trim() === '') {
        throw new Error('--target requires a path value');
      }

      options.target = value;
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  return options;
}

function assertSkillsDirectoryTarget(target) {
  if (basename(target) !== 'skills') {
    throw new Error('--target must be a parent directory named "skills".');
  }
}

async function resolveContainedTarget(target, projectRoot) {
  const resolvedTarget = await resolveFromNearestExistingAncestor(target);

  if (!isPathWithin(projectRoot, resolvedTarget)) {
    throw new Error(`Skills target must resolve within the current project: ${target}`);
  }

  return resolvedTarget;
}

async function resolveFromNearestExistingAncestor(target) {
  let ancestor = target;
  const missingSegments = [];

  while (true) {
    const entry = await lstat(ancestor).catch((error) => {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        return undefined;
      }

      throw error;
    });

    if (entry) {
      let resolvedAncestor;

      try {
        resolvedAncestor = await realpath(ancestor);
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'ELOOP') {
          throw new Error(`Skills target cannot resolve target path: ${ancestor}`);
        }

        throw error;
      }

      return resolve(resolvedAncestor, ...missingSegments);
    }

    const parent = dirname(ancestor);

    if (parent === ancestor) {
      throw new Error(`Skills target cannot resolve target path: ${target}`);
    }

    missingSegments.unshift(basename(ancestor));
    ancestor = parent;
  }
}

function isPathWithin(parent, child) {
  const pathFromParent = relative(parent, child);

  return pathFromParent === '' || (
    pathFromParent !== '..'
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent)
  );
}

async function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  const modulePath = fileURLToPath(import.meta.url);
  const [entryRealPath, moduleRealPath] = await Promise.all([
    realpath(process.argv[1]).catch(() => resolve(process.argv[1])),
    realpath(modulePath).catch(() => resolve(modulePath)),
  ]);

  return entryRealPath === moduleRealPath;
}

function usage() {
  return [
    'Usage: agent-doc-rules-skill [install] [options]',
    '',
    'Installs the agent-doc-rules and docs-duplicate-review skills into the current project.',
    '',
    'Options:',
    '  -t, --target <path>  Parent skills directory. Defaults to .agents/skills',
    '  -f, --force          Replace existing owned skill directories',
    '      --dry-run        Show what would be installed without writing files',
    '  -h, --help           Show this help',
  ].join('\n');
}
