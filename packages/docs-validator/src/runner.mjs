import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import fastGlob from 'fast-glob';
import writeGood from 'write-good';
import { findSecurityIssues, normalizeSecurityAllow } from './security.mjs';

const require = createRequire(import.meta.url);
export const defaultWriteGoodOptions = {
  passive: false,
  illusion: false,
  weasel: false,
  adverb: false,
  tooWordy: false,
  eprime: false,
};

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

export async function runWording(options, { logger = console } = {}) {
  const files = await resolveMarkdownFiles(options);
  const terms = normalizeWordingTerms(options.forbiddenTerms ?? []);
  const allowPatterns = (options.allow ?? []).map((pattern) => new RegExp(pattern, 'i'));
  const writeGoodConfig = normalizeWriteGoodOptions(options.writeGood);
  const termFindings = [];
  const writeGoodFindings = [];

  for (const file of files) {
    const content = await readFile(join(options.root, file), 'utf8');
    termFindings.push(...findWordingIssues(content, {
      file,
      terms,
      allowPatterns,
    }));

    if (writeGoodConfig.enabled) {
      writeGoodFindings.push(...findWriteGoodIssues(content, {
        file,
        allowPatterns,
        writeGoodOptions: writeGoodConfig.options,
      }));
    }
  }

  if (termFindings.length === 0 && writeGoodFindings.length === 0) {
    logger.log('Documentation wording check passed.');
    return 0;
  }

  if (termFindings.length > 0) {
    logger.error('Documentation wording check failed:');

    for (const finding of termFindings) {
      logger.error(
        `- ${finding.file}:${finding.line} uses "${finding.term}". `
        + `Prefer ${finding.suggest}.`,
      );
    }
  }

  if (writeGoodFindings.length > 0) {
    const writeGoodLogger = writeGoodConfig.fail ? logger.error : logger.log;
    writeGoodLogger(writeGoodConfig.fail
      ? 'write-good wording suggestions failed:'
      : 'write-good wording suggestions:');

    for (const finding of writeGoodFindings) {
      writeGoodLogger(
        `- ${finding.file}:${finding.line}:${finding.column} ${finding.reason}`,
      );
    }
  }

  return termFindings.length > 0 || (writeGoodConfig.fail && writeGoodFindings.length > 0)
    ? 1
    : 0;
}

export async function runSecurity(options, { logger = console } = {}) {
  const files = await resolveMarkdownFiles(options);
  const allowPatterns = normalizeSecurityAllow(options.allow ?? []);
  const findings = [];

  for (const file of files) {
    const content = await readFile(join(options.root, file), 'utf8');
    findings.push(...findSecurityIssues(content, {
      file,
      allowPatterns,
    }));
  }

  if (findings.length === 0) {
    logger.log('Documentation security check passed.');
    return 0;
  }

  logger.error('Documentation security check failed:');

  for (const finding of findings) {
    logger.error(`- ${finding.file}:${finding.line} ${finding.rule}: ${finding.message}`);

    if (finding.text) {
      logger.error(`  ${finding.text}`);
    }
  }

  return 1;
}

export async function runCheck(options, deps = {}) {
  const runMarkdownCommand = deps.runMarkdown ?? runMarkdown;
  const runWordingCommand = deps.runWording ?? runWording;
  const runSecurityCommand = deps.runSecurity ?? runSecurity;
  const runLinksCommand = deps.runLinks ?? runLinks;
  const markdownOptions = options.markdownOptions ?? options;
  const wordingOptions = options.wordingOptions ?? options;
  const securityOptions = options.securityOptions ?? options;
  const linksOptions = options.linksOptions ?? options;
  const markdownCode = await runMarkdownCommand(markdownOptions, deps);

  if (markdownCode !== 0) {
    return markdownCode;
  }

  const wordingCode = await runWordingCommand(wordingOptions, deps);

  if (wordingCode !== 0) {
    return wordingCode;
  }

  const securityCode = await runSecurityCommand(securityOptions, deps);

  if (securityCode !== 0) {
    return securityCode;
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

export function findWordingIssues(content, { file, terms, allowPatterns = [] }) {
  const findings = [];
  let inFence = false;
  const lines = content.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }

    if (inFence || allowPatterns.some((pattern) => pattern.test(line))) {
      continue;
    }

    for (const term of terms) {
      if (term.pattern.test(line)) {
        findings.push({
          file,
          line: index + 1,
          term: term.term,
          suggest: term.suggest,
        });
      }
    }
  }

  return findings;
}

export function findWriteGoodIssues(content, {
  file,
  allowPatterns = [],
  writeGoodOptions = defaultWriteGoodOptions,
}) {
  const masked = maskMarkdownForProseLint(content);
  const suggestions = writeGood(masked, writeGoodOptions);
  const lines = content.split('\n');

  return suggestions
    .map((suggestion) => {
      const location = getLineColumn(content, suggestion.index);
      const line = lines[location.line - 1] ?? '';

      return {
        file,
        line: location.line,
        column: location.column,
        reason: suggestion.reason,
        index: suggestion.index,
        offset: suggestion.offset,
        text: content.slice(suggestion.index, suggestion.index + suggestion.offset),
        ignored: allowPatterns.some((pattern) => pattern.test(line)),
      };
    })
    .filter((finding) => !finding.ignored)
    .map(({ ignored, ...finding }) => finding);
}

export function normalizeWordingTerms(terms) {
  return terms.map((term) => {
    const normalized = typeof term === 'string'
      ? { term, suggest: 'a more direct term' }
      : term;

    if (!normalized?.term) {
      throw new Error('Style terms must be strings or objects with a term field.');
    }

    return {
      term: normalized.term,
      suggest: normalized.suggest ?? 'a more direct term',
      pattern: new RegExp(`\\b${escapeRegExp(normalized.term)}\\b`, 'i'),
    };
  });
}

export function normalizeWriteGoodOptions(config = {}) {
  if (config === false) {
    return { enabled: false, fail: false, options: defaultWriteGoodOptions };
  }

  const { enabled = true, fail = false, ...options } = config ?? {};

  return {
    enabled,
    fail,
    options: {
      ...defaultWriteGoodOptions,
      ...options,
    },
  };
}

export function maskMarkdownForProseLint(content) {
  let masked = '';
  let inFence = false;

  for (const line of content.split(/(\n)/)) {
    if (line === '\n') {
      masked += line;
      continue;
    }

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      masked += maskNonNewlineCharacters(line);
      continue;
    }

    if (inFence || isMarkdownTableLine(line)) {
      masked += maskNonNewlineCharacters(line);
      continue;
    }

    masked += line.replace(/`[^`\n]+`/g, (match) => maskNonNewlineCharacters(match));
  }

  return masked;
}

function getLineColumn(content, index) {
  let line = 1;
  let column = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content[cursor] === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column };
}

function maskNonNewlineCharacters(value) {
  return value.replace(/[^\n]/g, ' ');
}

function isMarkdownTableLine(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
