import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';

const skippedEvidenceDirectories = new Set([
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

const skippedStateDirectories = new Set([
  '.git',
  'node_modules',
]);

const defaultEvidenceFileExtensions = new Set([
  '.cjs',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

export async function prepareProjectFixture(projectDir, {
  hiddenPackageScripts = ['test:agent'],
} = {}) {
  const packagePath = join(projectDir, 'package.json');
  const content = await readFile(packagePath, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (content === null) {
    return;
  }

  const packageJson = JSON.parse(content);
  let changed = false;

  for (const script of hiddenPackageScripts) {
    if (packageJson.scripts && Object.hasOwn(packageJson.scripts, script)) {
      delete packageJson.scripts[script];
      changed = true;
    }
  }

  if (packageJson.scripts && Object.keys(packageJson.scripts).length === 0) {
    delete packageJson.scripts;
  }

  if (changed) {
    await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }
}

export async function readProjectFiles(projectDir, options = {}) {
  const files = await collectProjectFilePaths(
    projectDir,
    projectDir,
    new Set([
      ...skippedEvidenceDirectories,
      ...(options.ignoredDirectoryNames ?? []),
    ]),
  );
  const chunks = [];
  const evidenceFileNames = new Set(options.evidenceFileNames ?? ['package.json']);
  const evidenceFileSuffixes = options.evidenceFileSuffixes ?? ['VERSION'];
  const evidenceFileExtensions = new Set(
    options.evidenceFileExtensions ?? defaultEvidenceFileExtensions,
  );
  const ignoredPaths = new Set(options.ignoredPaths ?? ['skills-lock.json']);
  const ignoredPathPrefixes = options.ignoredPathPrefixes ?? [];
  const hiddenPackageScripts = new Set(options.hiddenPackageScripts ?? ['test:agent']);
  const maxEvidenceFileBytes = options.maxEvidenceFileBytes ?? 256 * 1024;
  const maxEvidenceBytes = options.maxEvidenceBytes ?? 2 * 1024 * 1024;
  let evidenceBytes = 0;

  for (const file of files) {
    const rel = relativePath(projectDir, file);

    if (
      isIgnoredPath(rel, ignoredPaths, ignoredPathPrefixes)
      || !isProjectEvidenceFile(rel, evidenceFileNames, evidenceFileSuffixes, evidenceFileExtensions)
    ) {
      continue;
    }

    const fileSize = (await stat(file)).size;

    if (fileSize > maxEvidenceFileBytes) {
      throw new Error(
        `Judge evidence file exceeds ${maxEvidenceFileBytes} bytes: ${rel}`,
      );
    }

    evidenceBytes += fileSize;

    if (evidenceBytes > maxEvidenceBytes) {
      throw new Error(
        `Judge evidence exceeds ${maxEvidenceBytes} bytes while reading: ${rel}`,
      );
    }

    chunks.push(`--- ${rel} ---\n${await readProjectFileForPrompt(file, rel, {
      hiddenPackageScripts,
    })}`);
  }

  return chunks.join('\n\n');
}

export async function captureProjectState(projectDir, options = {}) {
  const files = await collectProjectFilePaths(
    projectDir,
    projectDir,
    new Set([
      ...skippedStateDirectories,
      ...(options.ignoredDirectoryNames ?? []),
    ]),
  );
  const ignoredPaths = new Set(options.ignoredPaths ?? []);
  const ignoredPathPrefixes = options.ignoredPathPrefixes ?? [];
  const state = new Map();

  for (const file of files) {
    const rel = relativePath(projectDir, file);

    if (isIgnoredPath(rel, ignoredPaths, ignoredPathPrefixes)) {
      continue;
    }

    state.set(rel, await readFile(file));
  }

  return state;
}

export function diffProjectStates(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  const changes = [];

  for (const path of [...paths].sort((a, b) => a.localeCompare(b))) {
    const previous = before.get(path);
    const current = after.get(path);

    if (previous && current && previous.equals(current)) {
      continue;
    }

    if (!current) {
      changes.push({ path, status: 'deleted' });
      continue;
    }

    changes.push({
      path,
      status: previous ? 'modified' : 'created',
      ...serializeFileContent(current),
    });
  }

  return changes;
}

export function assertProjectPathsUnchanged(before, after, {
  paths = [],
  pathPrefixes = [],
} = {}) {
  const protectedPaths = new Set(paths);
  const changes = diffProjectStates(before, after).filter((change) => (
    protectedPaths.has(change.path)
    || pathPrefixes.some((prefix) => change.path.startsWith(prefix))
  ));

  if (changes.length > 0) {
    throw new Error(
      `Agent modified protected runner files: ${changes.map((change) => change.path).join(', ')}`,
    );
  }
}

export function formatFileChanges(files) {
  return files.map((file) => {
    const header = `--- ${file.path} (${file.status ?? 'modified'}) ---`;

    if (file.status === 'deleted') {
      return `${header}\n(deleted)`;
    }

    if (file.encoding === 'base64') {
      return `${header}\n(binary file, ${file.byteLength} bytes)`;
    }

    return `${header}\n${file.content}`;
  }).join('\n\n');
}

export function formatConversationTurns(turns) {
  return turns.map((turn, index) => {
    const changes = formatFileChanges(turn.changes) || '(none)';
    const activity = formatAgentActivity(turn.activity ?? []);

    return `## Turn ${index + 1}: ${turn.id} (${turn.source})

User request:

${turn.prompt}

Agent response:

${turn.response}

Agent tool activity:

${activity}

Files changed during this turn:

${changes}`;
  }).join('\n\n');
}

export function formatAgentActivity(activity) {
  if (activity.length === 0) {
    return '(none recorded)';
  }

  return activity.map((item) => {
    if (item.type === 'command_execution') {
      const outcome = item.exitCode === null
        ? item.status ?? 'unknown status'
        : `exit ${item.exitCode}`;

      return `- command (${outcome}): ${item.commandSummary}`;
    }

    if (item.type === 'file_change') {
      const changes = item.changes
        .map((change) => `${change.kind ?? 'changed'} ${change.path}`)
        .join(', ');

      return `- file change (${item.status ?? 'unknown status'}): ${changes || '(none)'}`;
    }

    if (item.type === 'mcp_tool_call') {
      const name = [item.server, item.tool].filter(Boolean).join('/') || 'unknown tool';

      return `- MCP tool (${item.status ?? 'unknown status'}): ${name}`;
    }

    if (item.type === 'web_search') {
      return `- web search (${item.status ?? 'unknown status'})`;
    }

    return `- ${item.type ?? 'unknown activity'} (${item.status ?? 'unknown status'})`;
  }).join('\n');
}

export async function assertFile(path) {
  const info = await stat(path).catch(() => undefined);

  if (!info?.isFile()) {
    throw new Error(`Expected file was not created: ${path}`);
  }
}

export function decodeChangedFile(file) {
  if (file.encoding === 'base64') {
    return Buffer.from(file.content, 'base64');
  }

  return file.content;
}

async function readProjectFileForPrompt(file, rel, { hiddenPackageScripts }) {
  const content = await readFile(file);
  const serialized = serializeFileContent(content);

  if (serialized.encoding === 'base64') {
    return `(binary file, ${serialized.byteLength} bytes)\n`;
  }

  if (rel !== 'package.json') {
    return serialized.content;
  }

  const packageJson = JSON.parse(serialized.content);

  if (packageJson.scripts) {
    for (const script of hiddenPackageScripts) {
      delete packageJson.scripts[script];
    }

    if (Object.keys(packageJson.scripts).length === 0) {
      delete packageJson.scripts;
    }
  }

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

async function collectProjectFilePaths(dir, root, skippedDirectories) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    const rel = relativePath(root, path);

    if (
      skippedDirectories.has(entry.name)
      && (entry.isDirectory() || entry.isSymbolicLink())
    ) {
      continue;
    }

    if (entry.isSymbolicLink()) {
      throw new Error(`Agent E2E project must not contain symbolic links: ${rel}`);
    }

    if (entry.isDirectory()) {
      files.push(...await collectProjectFilePaths(path, root, skippedDirectories));
      continue;
    }

    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort();
}

function isProjectEvidenceFile(rel, evidenceNames, evidenceSuffixes, evidenceExtensions) {
  const name = rel.split('/').at(-1);

  return evidenceExtensions.has(extname(rel))
    || evidenceSuffixes.some((suffix) => rel.endsWith(suffix))
    || evidenceNames.has(name)
    || evidenceNames.has(rel);
}

function isIgnoredPath(rel, ignoredPaths, ignoredPathPrefixes) {
  return ignoredPaths.has(rel)
    || ignoredPathPrefixes.some((prefix) => rel.startsWith(prefix));
}

function relativePath(root, path) {
  return relative(root, path).replaceAll('\\', '/');
}

function serializeFileContent(buffer) {
  try {
    const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);

    if (!content.includes('\0')) {
      return { content };
    }
  } catch {
    // Fall through to a base64 representation for binary files.
  }

  return {
    content: buffer.toString('base64'),
    encoding: 'base64',
    byteLength: buffer.byteLength,
  };
}
