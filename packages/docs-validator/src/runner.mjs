import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import fastGlob from 'fast-glob';

const require = createRequire(import.meta.url);

export function buildMarkdownlintArgs({ include, exclude }) {
  return [
    ...include,
    ...expandExcludePatterns(exclude).map((pattern) => `!${pattern}`),
  ];
}

export function buildLinkinatorArgs({ files, skip = [], checkFragments = true }) {
  const args = ['--markdown', '--directory-listing'];

  if (checkFragments) {
    args.push('--check-fragments');
  }

  for (const pattern of skip) {
    args.push('--skip', pattern);
  }

  return [...args, ...files];
}

export async function resolveMarkdownFiles({ root, include, exclude }) {
  const files = await fastGlob(include, {
    cwd: root,
    dot: true,
    ignore: expandExcludePatterns(exclude),
    onlyFiles: true,
    unique: true,
  });

  return files
    .filter((file) => file.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right));
}

export async function runMarkdown({ root, include, exclude }, { runner = runNodeBin } = {}) {
  const bin = resolveMarkdownlintBin();
  const args = buildMarkdownlintArgs({ include, exclude });
  return runner({ bin, args, cwd: root });
}

export async function runLinks(options, { runner = runNodeBin } = {}) {
  const files = await resolveMarkdownFiles(options);

  if (files.length === 0) {
    console.log('No Markdown files found for link validation.');
    return 0;
  }

  const bin = resolvePackageBin('linkinator', 'linkinator');
  const args = buildLinkinatorArgs({
    files,
    skip: options.skip,
    checkFragments: options.checkFragments,
  });

  return runner({ bin, args, cwd: options.root });
}

export async function runCheck(options, deps = {}) {
  const runMarkdownCommand = deps.runMarkdown ?? runMarkdown;
  const runLinksCommand = deps.runLinks ?? runLinks;
  const markdownOptions = options.markdownOptions ?? options;
  const linksOptions = options.linksOptions ?? options;
  const markdownCode = await runMarkdownCommand(markdownOptions, deps);

  if (markdownCode !== 0) {
    return markdownCode;
  }

  return runLinksCommand(linksOptions, deps);
}

export function resolveMarkdownlintBin() {
  const entry = require.resolve('markdownlint-cli2');
  return join(dirname(entry), 'markdownlint-cli2-bin.mjs');
}

export function resolvePackageBin(packageName, binName) {
  for (const packageJsonPath of resolvePackageJsonPaths(packageName)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const bin = typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.[binName];

    if (!bin) {
      continue;
    }

    const binPath = join(dirname(packageJsonPath), bin);

    if (existsSync(binPath)) {
      return binPath;
    }
  }

  throw new Error(`Package ${packageName} does not expose bin ${binName}.`);
}

export function resolvePackageJsonPaths(packageName) {
  const packageJsonPaths = [];

  try {
    packageJsonPaths.push(require.resolve(`${packageName}/package.json`));
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      throw error;
    }
  }

  if (packageJsonPaths.length > 0) {
    return [...new Set(packageJsonPaths)];
  }

  let directory = dirname(require.resolve(packageName));

  while (true) {
    const candidate = join(directory, 'package.json');

    if (existsSync(candidate)) {
      const packageJson = JSON.parse(readFileSync(candidate, 'utf8'));

      if (packageJson.name === packageName) {
        packageJsonPaths.push(candidate);
      }
    }

    const parent = dirname(directory);

    if (parent === directory) {
      break;
    }

    directory = parent;
  }

  return [...new Set(packageJsonPaths)];
}

export function runNodeBin({ bin, args, cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        NO_COLOR: process.env.NO_COLOR ?? '1',
      },
    });

    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

export function expandExcludePatterns(exclude) {
  const expanded = [];

  for (const pattern of exclude) {
    expanded.push(pattern);

    if (!pattern.startsWith('**/') && !pattern.startsWith('/')) {
      expanded.push(`**/${pattern}`);
    }
  }

  return [...new Set(expanded)];
}
