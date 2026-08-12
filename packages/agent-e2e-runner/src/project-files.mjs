import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import {
  isSensitiveReportContent,
  isSensitiveReportPath,
} from '@buresmi7/agent-e2e-report';

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

const defaultReportFileBytes = 256 * 1024;
const defaultReportDiffBytes = 512 * 1024;
const defaultReportPatchBytes = 8 * 1024 * 1024;
const defaultReportChanges = 2000;
const defaultStateFileBytes = 16 * 1024 * 1024;
const defaultStateFiles = 10000;
const defaultStateTotalBytes = 256 * 1024 * 1024;

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
  const maxProjectFiles = options.maxProjectFiles ?? defaultStateFiles;
  const files = await collectProjectFilePaths(
    projectDir,
    projectDir,
    new Set([
      ...skippedEvidenceDirectories,
      ...(options.ignoredDirectoryNames ?? []),
    ]),
    { maxFiles: maxProjectFiles },
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
  const maxStateFileBytes = options.maxStateFileBytes ?? defaultStateFileBytes;
  const maxStateFiles = options.maxStateFiles ?? defaultStateFiles;
  const maxStateBytes = options.maxStateBytes ?? defaultStateTotalBytes;

  for (const [name, value] of [
    ['maxStateFileBytes', maxStateFileBytes],
    ['maxStateFiles', maxStateFiles],
    ['maxStateBytes', maxStateBytes],
  ]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer.`);
    }
  }

  const files = await collectProjectFilePaths(
    projectDir,
    projectDir,
    new Set([
      ...skippedStateDirectories,
      ...(options.ignoredDirectoryNames ?? []),
    ]),
    { maxFiles: maxStateFiles },
  );
  const ignoredPaths = new Set(options.ignoredPaths ?? []);
  const ignoredPathPrefixes = options.ignoredPathPrefixes ?? [];
  const state = new Map();
  let stateBytes = 0;

  for (const file of files) {
    const rel = relativePath(projectDir, file);

    if (isIgnoredPath(rel, ignoredPaths, ignoredPathPrefixes)) {
      continue;
    }

    const fileSize = (await stat(file)).size;

    if (fileSize > maxStateFileBytes) {
      throw new Error(`Project state file exceeds ${maxStateFileBytes} bytes: ${rel}`);
    }

    stateBytes += fileSize;

    if (stateBytes > maxStateBytes) {
      throw new Error(`Project state exceeds ${maxStateBytes} bytes while reading: ${rel}`);
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

export function diffProjectStatesForReport(before, after, {
  maxFileBytes = defaultReportFileBytes,
  maxDiffBytes = defaultReportDiffBytes,
  maxChanges = defaultReportChanges,
  budget = { remainingBytes: defaultReportPatchBytes },
} = {}) {
  if (!Number.isInteger(maxFileBytes) || maxFileBytes < 0) {
    throw new Error('maxReportFileBytes must be a non-negative integer.');
  }

  if (!Number.isInteger(maxDiffBytes) || maxDiffBytes < 0) {
    throw new Error('maxReportDiffBytes must be a non-negative integer.');
  }

  if (!Number.isInteger(maxChanges) || maxChanges < 0) {
    throw new Error('maxReportChanges must be a non-negative integer.');
  }

  if (!budget || !Number.isInteger(budget.remainingBytes) || budget.remainingBytes < 0) {
    throw new Error('report budget must contain a non-negative remainingBytes integer.');
  }

  const paths = new Set([...before.keys(), ...after.keys()]);
  const changes = [];

  for (const path of [...paths].sort((a, b) => a.localeCompare(b))) {
    const previous = before.get(path);
    const current = after.get(path);

    if (previous && current && previous.equals(current)) {
      continue;
    }

    if (changes.length >= maxChanges) {
      throw new Error(`Report diff exceeds the ${maxChanges}-change limit.`);
    }

    changes.push(createReportChange({
      path,
      status: !current ? 'deleted' : previous ? 'modified' : 'created',
      previous,
      current,
      maxFileBytes,
      maxDiffBytes,
      budget,
    }));
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

async function collectProjectFilePaths(
  dir,
  root,
  skippedDirectories,
  { maxFiles = defaultStateFiles, counter = { value: 0 } } = {},
) {
  if (!Number.isInteger(maxFiles) || maxFiles < 0) {
    throw new Error('maxProjectFiles must be a non-negative integer.');
  }

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
      files.push(...await collectProjectFilePaths(path, root, skippedDirectories, {
        maxFiles,
        counter,
      }));
      continue;
    }

    if (entry.isFile()) {
      if (counter.value >= maxFiles) {
        throw new Error(`Agent E2E project exceeds the ${maxFiles}-file limit.`);
      }

      counter.value += 1;
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

function createReportChange({
  path,
  status,
  previous,
  current,
  maxFileBytes,
  maxDiffBytes,
  budget,
}) {
  const sensitiveReason = isSensitiveReportPath(path)
    ? 'sensitive-path'
    : [previous, current].some((buffer) => (
        buffer?.byteLength <= maxFileBytes && isSensitiveReportContent(buffer)
      ))
      ? 'sensitive-content'
      : null;
  const sensitive = sensitiveReason !== null;
  const before = previous
    ? serializeReportFileMetadata(previous, maxFileBytes, sensitive)
    : null;
  const after = current
    ? serializeReportFileMetadata(current, maxFileBytes, sensitive)
    : null;
  const change = {
    path,
    status,
    before,
    after,
    patch: null,
    omission: null,
  };

  if (sensitive) {
    change.omission = { reason: sensitiveReason };
    return removeReportContent(change);
  }

  if (
    (status === 'created' && current?.byteLength === 0)
    || (status === 'deleted' && previous?.byteLength === 0)
  ) {
    change.omission = { reason: 'empty-file' };
    return removeReportContent(change);
  }

  if (before?.kind === 'binary' || after?.kind === 'binary') {
    change.omission = { reason: 'binary' };
    return removeReportContent(change);
  }

  if (before?.kind === 'omitted' || after?.kind === 'omitted') {
    change.omission = { reason: 'file-too-large' };
    return removeReportContent(change);
  }

  const lines = createUnifiedPatch(
    path,
    before?.content ?? '',
    after?.content ?? '',
    status,
  );
  const patchBytes = Buffer.byteLength(JSON.stringify(lines), 'utf8');

  if (patchBytes > maxDiffBytes) {
    change.omission = { reason: 'diff-too-large', byteLength: patchBytes };
    return removeReportContent(change);
  }

  if (patchBytes > budget.remainingBytes) {
    change.omission = { reason: 'report-budget', byteLength: patchBytes };
    return removeReportContent(change);
  }

  budget.remainingBytes -= patchBytes;
  change.patch = {
    format: 'unified',
    lines,
  };

  return removeReportContent(change);
}

function serializeReportFileMetadata(buffer, maxFileBytes, sensitive) {
  if (sensitive || buffer.byteLength > maxFileBytes) {
    return {
      kind: 'omitted',
      byteLength: buffer.byteLength,
    };
  }

  const serialized = serializeFileContent(buffer);

  if (serialized.encoding === 'base64') {
    return {
      kind: 'binary',
      byteLength: buffer.byteLength,
    };
  }

  return {
    kind: 'text',
    content: serialized.content,
    byteLength: buffer.byteLength,
  };
}

function removeReportContent(change) {
  for (const version of [change.before, change.after]) {
    if (version) {
      delete version.content;
    }
  }

  return change;
}

function createUnifiedPatch(path, beforeContent, afterContent, status) {
  const beforeLines = splitLines(beforeContent);
  const afterLines = splitLines(afterContent);
  let prefix = 0;

  while (
    prefix < beforeLines.length
    && prefix < afterLines.length
    && beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;

  while (
    suffix < beforeLines.length - prefix
    && suffix < afterLines.length - prefix
    && beforeLines[beforeLines.length - suffix - 1]
      === afterLines[afterLines.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const context = 3;
  const beforeStart = Math.max(0, prefix - context);
  const afterStart = Math.max(0, prefix - context);
  const beforeChangeEnd = beforeLines.length - suffix;
  const afterChangeEnd = afterLines.length - suffix;
  const beforeEnd = Math.min(beforeLines.length, beforeChangeEnd + context);
  const afterEnd = Math.min(afterLines.length, afterChangeEnd + context);
  const lines = [
    `--- ${status === 'created' ? '/dev/null' : formatDiffPath(`a/${path}`)}`,
    `+++ ${status === 'deleted' ? '/dev/null' : formatDiffPath(`b/${path}`)}`,
    `@@ -${formatDiffRange(beforeStart, beforeEnd - beforeStart)}`
      + ` +${formatDiffRange(afterStart, afterEnd - afterStart)} @@`,
  ];

  for (const line of beforeLines.slice(beforeStart, prefix)) {
    appendPatchLine(lines, ' ', line);
  }

  for (const line of beforeLines.slice(prefix, beforeChangeEnd)) {
    appendPatchLine(lines, '-', line);
  }

  for (const line of afterLines.slice(prefix, afterChangeEnd)) {
    appendPatchLine(lines, '+', line);
  }

  for (const line of beforeLines.slice(beforeChangeEnd, beforeEnd)) {
    appendPatchLine(lines, ' ', line);
  }

  return lines;
}

function splitLines(value) {
  if (!value) {
    return [];
  }

  return value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function appendPatchLine(lines, prefix, line) {
  const hasFinalNewline = line.endsWith('\n');
  const content = hasFinalNewline ? line.slice(0, -1) : line;

  lines.push(`${prefix}${content}`);

  if (!hasFinalNewline) {
    lines.push('\\ No newline at end of file');
  }
}

function formatDiffRange(start, count) {
  const line = count === 0 ? start : start + 1;

  return count === 1 ? String(line) : `${line},${count}`;
}

function formatDiffPath(path) {
  return /[\u0000-\u001f\u007f"\\]/.test(path) ? JSON.stringify(path) : path;
}
