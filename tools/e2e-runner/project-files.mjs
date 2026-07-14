import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

const skippedProjectDirectories = new Set([
  '.cache',
  '.git',
  '.next',
  '.output',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

const javascriptEvidencePrefixes = [
  'bin/',
  'lib/',
  'scripts/',
  'src/',
  'test/',
  'tests/',
  'tools/',
];

export async function readProjectFiles(projectDir) {
  const files = await collectFiles(projectDir);
  const chunks = [];

  for (const file of files) {
    const rel = relative(projectDir, file);

    if (rel.startsWith('.agents/skills/agent-doc-rules/') || rel === 'skills-lock.json') {
      continue;
    }

    chunks.push(`--- ${rel} ---\n${await readProjectFileForPrompt(file, rel)}`);
  }

  return chunks.join('\n\n');
}

export function normalizeGeneratedFiles(files) {
  if (!Array.isArray(files)) {
    throw new Error('Generator did not return a files array.');
  }

  const seen = new Set();

  return files.map((file) => {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string') {
      throw new Error('Generator returned an invalid file entry.');
    }

    const normalizedPath = file.path.replaceAll('\\', '/').replace(/^\.\/+/, '');

    if (!normalizedPath || normalizedPath.startsWith('/') || normalizedPath.includes('../')) {
      throw new Error(`Generator returned unsafe file path: ${file.path}`);
    }

    if (normalizedPath.startsWith('.agents/skills/agent-doc-rules/')) {
      throw new Error(`Generator must not modify installed skill files: ${normalizedPath}`);
    }

    if (seen.has(normalizedPath)) {
      throw new Error(`Generator returned duplicate file path: ${normalizedPath}`);
    }

    seen.add(normalizedPath);

    return {
      path: normalizedPath,
      content: `${file.content.trim()}\n`,
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

export async function writeGeneratedFiles(projectDir, files) {
  for (const file of files) {
    const target = join(projectDir, file.path);

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

export function formatGeneratedFiles(files) {
  return files.map((file) => {
    return `--- ${file.path} ---\n${file.content}`;
  }).join('\n\n');
}

export function collectFinalGeneratedFiles(turns) {
  const latest = new Map();

  for (const turn of turns) {
    for (const file of turn.generatedFiles) {
      latest.set(file.path, file);
    }
  }

  return [...latest.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function formatGeneratedTurns(turns) {
  return turns.map((turn, index) => {
    const generatedFiles = formatGeneratedFiles(turn.generatedFiles) || '(none)';

    return `## Turn ${index + 1}: ${turn.source}

User request:

${turn.prompt}

Agent notes:

${turn.notes}

Generated files:

${generatedFiles}`;
  }).join('\n\n');
}

export async function assertFile(path) {
  const info = await stat(path).catch(() => undefined);

  if (!info?.isFile()) {
    throw new Error(`Expected file was not created: ${path}`);
  }
}

async function readProjectFileForPrompt(file, rel) {
  const content = await readFile(file, 'utf8');

  if (rel !== 'package.json') {
    return content;
  }

  const packageJson = JSON.parse(content);

  if (packageJson.scripts) {
    delete packageJson.scripts['test:agent'];

    if (Object.keys(packageJson.scripts).length === 0) {
      delete packageJson.scripts;
    }
  }

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function collectFiles(dir, root = dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      if (skippedProjectDirectories.has(entry)) {
        continue;
      }

      files.push(...await collectFiles(path, root));
      continue;
    }

    const rel = relative(root, path).replaceAll('\\', '/');

    if (isProjectEvidenceFile(rel, entry)) {
      files.push(path);
    }
  }

  return files.sort();
}

function isProjectEvidenceFile(rel, entry) {
  return rel.endsWith('.md')
    || isJavascriptEvidenceFile(rel)
    || rel.endsWith('VERSION')
    || entry === 'package.json'
    || entry === 'agent-doc-rules.config.json';
}

function isJavascriptEvidenceFile(rel) {
  return rel.endsWith('.js')
    && javascriptEvidencePrefixes.some((prefix) => rel.startsWith(prefix));
}
