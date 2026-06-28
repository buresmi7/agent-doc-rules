#!/usr/bin/env node
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultTarget = join(process.cwd(), '.agents', 'skills', 'agent-doc-rules');
const skillEntries = [
  'SKILL.md',
  'README.md',
  'agents',
  'assets',
  'docs',
  'references',
];

await main().catch((error) => {
  console.error(`agent-doc-rules-skill: ${error.message}`);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const target = resolve(process.cwd(), options.target ?? defaultTarget);
  assertSafeTarget(target);

  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const existingTarget = await stat(target).catch((error) => {
    if (error?.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  });

  if (existingTarget && !existingTarget.isDirectory()) {
    throw new Error(`Target exists but is not a directory: ${target}`);
  }

  if (existingTarget && !options.force) {
    throw new Error(`Target already exists: ${target}\nRe-run with --force to replace it.`);
  }

  if (options.dryRun) {
    console.log(`Would install ${packageJson.name}@${packageJson.version} to ${target}`);
    console.log(`Entries: ${skillEntries.join(', ')}`);
    return;
  }

  if (existingTarget) {
    await rm(target, { recursive: true, force: true });
  }

  await mkdir(target, { recursive: true });

  for (const entry of skillEntries) {
    await cp(join(packageRoot, entry), join(target, entry), { recursive: true });
  }

  console.log(`Installed ${packageJson.name}@${packageJson.version} to ${target}`);
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

      if (!value) {
        throw new Error(`${arg} requires a path value`);
      }

      options.target = value;
      index += 1;
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}\n\n${usage()}`);
    }
  }

  return options;
}

function assertSafeTarget(target) {
  if (basename(target) !== 'agent-doc-rules') {
    throw new Error('Target directory must be named agent-doc-rules.');
  }
}

function usage() {
  return [
    'Usage: agent-doc-rules-skill [install] [options]',
    '',
    'Installs the agent-doc-rules skill into the current project.',
    '',
    'Options:',
    '  -t, --target <path>  Target skill directory. Defaults to .agents/skills/agent-doc-rules',
    '  -f, --force          Replace an existing target directory',
    '      --dry-run        Show what would be installed without writing files',
    '  -h, --help           Show this help',
  ].join('\n');
}
