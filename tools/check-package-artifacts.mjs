import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootPackage = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
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
    ],
  },
  {
    dir: 'packages/docs-duplicates',
    name: '@buresmi7/agent-doc-rules-docs-duplicates',
    bin: {
      'agent-doc-rules-docs-duplicates': 'bin/agent-doc-rules-docs-duplicates.mjs',
    },
    files: ['bin', 'src', 'README.md'],
    readmeTerms: [
      '@buresmi7/agent-doc-rules-docs-duplicates',
      'agent-doc-rules-docs-duplicates check',
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

  if (packageJson.version !== rootPackage.version) {
    errors.push(`${packageInfo.dir}/package.json version must match root version ${rootPackage.version}.`);
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

  const readme = await readFile(join(packageDir, 'README.md'), 'utf8');

  for (const term of packageInfo.readmeTerms) {
    if (!readme.includes(term)) {
      errors.push(`${packageInfo.dir}/README.md must mention ${term}.`);
    }
  }
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
