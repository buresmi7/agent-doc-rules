import { access, readFile, readdir, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findConsumerAiDependencyViolations,
  findConsumerAiTextViolations,
  findConsumerRuntimeDependencyViolations,
} from './consumer-ai-boundary.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

const packages = [
  {
    dir: 'packages/docs-validator',
    name: '@buresmi7/agent-doc-rules-docs-validator',
    bin: {
      'agent-doc-rules-docs': 'bin/agent-doc-rules-docs.mjs',
    },
    files: ['bin', 'src', 'README.md'],
    readmeTerms: [
      '@buresmi7/agent-doc-rules-docs-validator',
      'agent-doc-rules-docs check',
      'agent-doc-rules-docs duplicate-candidates',
    ],
    consumerAiBoundary: true,
    runtimeDependencies: [
      'fast-glob',
      'linkinator',
      'markdownlint-cli2',
      'mdast-util-to-string',
      'remark-parse',
      'sentence-splitter',
      'unified',
      'unist-util-visit',
      'write-good',
    ],
  },
  {
    dir: 'packages/agent-e2e-runner',
    name: '@buresmi7/agent-e2e-runner',
    bin: {
      'agent-e2e-runner': 'bin/agent-e2e-runner.mjs',
    },
    files: ['bin', 'docs', 'examples', 'src', 'README.md'],
    readmeTerms: [
      '@buresmi7/agent-e2e-runner',
      'agent-e2e-runner agent',
      'agent-e2e-runner command',
    ],
  },
  {
    dir: 'packages/agent-e2e-report',
    name: '@buresmi7/agent-e2e-report',
    bin: {},
    files: ['docs', 'src', 'README.md'],
    readmeTerms: [
      '@buresmi7/agent-e2e-report',
      'report.json',
      'validateScenarioReport',
    ],
  },
];

for (const packageInfo of packages) {
  await checkPackage(packageInfo);
}

if (errors.length > 0) {
  console.error('Package artifact check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Package artifact check passed.');

async function checkPackage(packageInfo) {
  const packageDir = join(repoRoot, packageInfo.dir);
  const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));

  if (packageJson.name !== packageInfo.name) {
    errors.push(`${packageInfo.dir}/package.json name must be ${packageInfo.name}.`);
  }

  if (packageJson.private !== false) {
    errors.push(`${packageInfo.dir}/package.json private must be false for npm publication.`);
  }

  if (packageJson.license !== 'MIT') {
    errors.push(`${packageInfo.dir}/package.json license must be MIT.`);
  }

  if (packageJson.publishConfig?.access !== 'public') {
    errors.push(`${packageInfo.dir}/package.json publishConfig.access must be public.`);
  }

  for (const [binName, binPath] of Object.entries(packageInfo.bin)) {
    if (packageJson.bin?.[binName] !== binPath) {
      errors.push(`${packageInfo.dir}/package.json bin.${binName} must point to ${binPath}.`);
      continue;
    }

    const absoluteBinPath = join(packageDir, binPath);
    await assertPath(absoluteBinPath, `${packageInfo.dir}/${binPath} must exist.`);
    await assertExecutable(absoluteBinPath, `${packageInfo.dir}/${binPath} must be executable.`);
    await assertShebang(absoluteBinPath, `${packageInfo.dir}/${binPath} must start with a Node shebang.`);
  }

  for (const file of packageInfo.files) {
    if (!packageJson.files?.includes(file)) {
      errors.push(`${packageInfo.dir}/package.json files must include ${file}.`);
    }

    await assertPath(join(packageDir, file), `${packageInfo.dir}/${file} must exist.`);
  }

  for (const entry of packageJson.files ?? []) {
    const normalizedEntry = entry.replaceAll('\\', '/').replace(/^\.\//, '');

    if (/^(?:e2e|test)(?:\/|$)/.test(normalizedEntry)) {
      errors.push(`${packageInfo.dir}/package.json files must not publish ${entry}.`);
    }
  }

  const readme = await readFile(join(packageDir, 'README.md'), 'utf8');

  for (const term of packageInfo.readmeTerms) {
    if (!readme.includes(term)) {
      errors.push(`${packageInfo.dir}/README.md must mention ${term}.`);
    }
  }

  if (packageInfo.consumerAiBoundary) {
    await checkConsumerAiBoundary(packageInfo, packageDir, packageJson);
  }
}

async function checkConsumerAiBoundary(packageInfo, packageDir, packageJson) {
  for (const violation of findConsumerAiDependencyViolations(packageJson)) {
    errors.push(`${packageInfo.dir}/package.json contains ${violation}.`);
  }

  for (const violation of findConsumerRuntimeDependencyViolations(
    packageJson,
    packageInfo.runtimeDependencies,
  )) {
    errors.push(`${packageInfo.dir}/package.json contains unaudited runtime dependency ${violation}.`);
  }

  const files = [join(packageDir, 'package.json')];

  for (const entry of packageJson.files ?? []) {
    files.push(...await collectFiles(join(packageDir, entry)));
  }

  for (const file of files) {
    if (!['.cjs', '.js', '.json', '.md', '.mjs', '.ts', '.yaml', '.yml'].includes(extname(file))) {
      continue;
    }

    const content = await readFile(file, 'utf8');
    const violations = findConsumerAiTextViolations(content, {
      allowRetiredMigration: relative(packageDir, file).replaceAll('\\', '/') === 'README.md',
    });

    for (const violation of violations) {
      errors.push(
        `${relative(repoRoot, file)} contains ${violation.label}: ${violation.match}.`,
      );
    }
  }
}

async function collectFiles(path) {
  const info = await stat(path);

  if (info.isFile()) {
    return [path];
  }

  const files = [];

  for (const entry of await readdir(path, { withFileTypes: true })) {
    files.push(...await collectFiles(join(path, entry.name)));
  }

  return files;
}

async function assertPath(path, message) {
  try {
    await access(path);
  } catch {
    errors.push(message);
  }
}

async function assertExecutable(path, message) {
  try {
    const mode = (await stat(path)).mode;

    if ((mode & constants.S_IXUSR) === 0) {
      errors.push(message);
    }
  } catch {
    errors.push(message);
  }
}

async function assertShebang(path, message) {
  try {
    const content = await readFile(path, 'utf8');

    if (!content.startsWith('#!/usr/bin/env node\n')) {
      errors.push(message);
    }
  } catch {
    errors.push(message);
  }
}
