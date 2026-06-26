import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

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

async function collectFiles(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    if (['node_modules', '.git'].includes(entry)) {
      continue;
    }

    const path = join(dir, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      files.push(...await collectFiles(path));
      continue;
    }

    if (path.endsWith('.md') || path.endsWith('VERSION') || entry === 'package.json') {
      files.push(path);
    }
  }

  return files.sort();
}
