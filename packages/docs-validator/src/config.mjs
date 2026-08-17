import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import {
  defaultConfigFile,
  defaultExclude,
  defaultInclude,
  duplicateCandidateDefaults,
} from './defaults.mjs';
import { normalizeIgnorePairs } from './duplicate-candidates.mjs';
import { validateRepoRelativeGlobs } from './duplicate-markdown.mjs';

const retiredWarnScoreDefault = 0.78;
const retiredCandidateThresholdCap = 0.72;

export async function loadDocsConfig({ root = process.cwd(), configPath } = {}) {
  const resolvedRoot = resolve(root);
  const resolvedConfigPath = configPath
    ? resolvePath(resolvedRoot, configPath)
    : resolve(resolvedRoot, defaultConfigFile);

  try {
    const raw = await readFile(resolvedConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    const config = parsed.docs ?? parsed;
    validateRemovedAiConfig(config);

    if (Object.hasOwn(config, 'duplicateCandidates')) {
      validateDuplicateCandidateConfig(config.duplicateCandidates);
    }

    return config;
  } catch (error) {
    if (error.code === 'ENOENT' && !configPath) {
      return {};
    }

    throw error;
  }
}

export async function resolveDuplicateCandidateOptions(flags = {}) {
  const root = resolve(flags.root ?? process.cwd());
  const config = await loadDocsConfig({ root, configPath: flags.configPath });
  const candidateConfig = config.duplicateCandidates ?? {};

  const options = {
    root,
    include: chooseArray(flags.include, candidateConfig.include, config.include, defaultInclude),
    exclude: chooseArray(flags.exclude, candidateConfig.exclude, config.exclude, defaultExclude),
    focus: flags.focus ?? [],
    includeReferences: flags.includeReferences
      ?? candidateConfig.includeReferences
      ?? duplicateCandidateDefaults.includeReferences,
    includeSameFile: flags.includeSameFile
      ?? candidateConfig.includeSameFile
      ?? duplicateCandidateDefaults.includeSameFile,
    ignorePairs: chooseArray(candidateConfig.ignorePairs, duplicateCandidateDefaults.ignorePairs),
    minSimilarity: chooseNumber(
      flags.minSimilarity,
      candidateConfig.minSimilarity,
      duplicateCandidateDefaults.minSimilarity,
    ),
    minWords: chooseNumber(flags.minWords, candidateConfig.minWords, duplicateCandidateDefaults.minWords),
    minChars: chooseNumber(flags.minChars, candidateConfig.minChars, duplicateCandidateDefaults.minChars),
    maxCandidates: chooseNumber(
      flags.maxCandidates,
      candidateConfig.maxCandidates,
      duplicateCandidateDefaults.maxCandidates,
    ),
    cursor: flags.cursor,
    format: flags.format ?? 'text',
  };

  validateDuplicateCandidateOptions(options);
  return options;
}

export async function resolveDocsOptions({
  command = 'markdown',
  root = process.cwd(),
  configPath,
  include = [],
  exclude = [],
  skip = [],
  checkFragments,
  forbiddenTerms = [],
  allow = [],
  writeGood,
} = {}) {
  const resolvedRoot = resolve(root);
  const config = await loadDocsConfig({ root: resolvedRoot, configPath });
  const commandConfig = config[command] ?? {};
  const linkConfig = command === 'links' ? (config.links ?? {}) : {};
  const wordingConfig = command === 'wording' ? (config.wording ?? {}) : {};

  return {
    root: resolvedRoot,
    include: chooseArray(include, commandConfig.include, config.include, defaultInclude),
    exclude: chooseArray(exclude, commandConfig.exclude, config.exclude, defaultExclude),
    skip: chooseArray(skip, linkConfig.skip, commandConfig.skip, []),
    checkFragments: checkFragments ?? linkConfig.checkFragments ?? commandConfig.checkFragments ?? true,
    forbiddenTerms: chooseArray(forbiddenTerms, wordingConfig.forbiddenTerms, commandConfig.forbiddenTerms, []),
    allow: chooseArray(allow, wordingConfig.allow, commandConfig.allow, []),
    writeGood: chooseObject(writeGood, wordingConfig.writeGood, commandConfig.writeGood, {}),
  };
}

function chooseArray(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  return [];
}

function chooseObject(...candidates) {
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate;
    }

    if (candidate === false) {
      return false;
    }
  }

  return {};
}

function chooseNumber(...candidates) {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && !Number.isNaN(Number(candidate))) {
      return Number(candidate);
    }
  }

  return undefined;
}

function validateRemovedAiConfig(config) {
  if (Object.hasOwn(config, 'duplicates')) {
    throw new Error(
      'docs.duplicates was removed. Move deterministic settings to '
      + 'docs.duplicateCandidates. '
      + `${duplicateThresholdMigrationGuidance(config.duplicates)} `
      + 'Remove provider settings and failScore.',
    );
  }

  if (Object.hasOwn(config, 'style')) {
    throw new Error(
      'docs.style was removed. Remove this section; style review is now performed '
      + 'by the agent-doc-rules skill.',
    );
  }
}

function validateDuplicateCandidateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('docs.duplicateCandidates must be an object.');
  }

  const supportedKeys = new Set([
    'include',
    'exclude',
    'includeReferences',
    'includeSameFile',
    'minSimilarity',
    'minWords',
    'minChars',
    'maxCandidates',
    'ignorePairs',
  ]);
  if (Object.hasOwn(config, 'warnScore')) {
    throw new Error(
      'docs.duplicateCandidates.warnScore was removed. '
      + duplicateThresholdMigrationGuidance(config),
    );
  }

  if (Object.hasOwn(config, 'failScore')) {
    throw new Error(
      'docs.duplicateCandidates.failScore was removed. Candidate similarity does '
      + 'not determine review severity.',
    );
  }

  if (Object.hasOwn(config, 'minScore')) {
    throw new Error(
      'docs.duplicateCandidates.minScore was renamed to '
      + 'docs.duplicateCandidates.minSimilarity.',
    );
  }

  if (Object.hasOwn(config, 'focus')) {
    throw new Error(
      'docs.duplicateCandidates.focus is not a persistent setting. Use repeatable '
      + '--focus flags for the files changed in the current review.',
    );
  }

  if (Object.hasOwn(config, 'format')) {
    throw new Error(
      'docs.duplicateCandidates.format is not a persistent setting. Use '
      + '--format text or --format json.',
    );
  }

  for (const key of ['include', 'exclude']) {
    if (
      Object.hasOwn(config, key)
      && (
        !Array.isArray(config[key])
        || config[key].some((value) => typeof value !== 'string')
      )
    ) {
      throw new Error(`docs.duplicateCandidates.${key} must be an array of globs.`);
    }
  }

  for (const key of ['includeReferences', 'includeSameFile']) {
    if (Object.hasOwn(config, key) && typeof config[key] !== 'boolean') {
      throw new Error(`docs.duplicateCandidates.${key} must be a boolean.`);
    }
  }

  if (
    Object.hasOwn(config, 'minSimilarity')
    && (
      typeof config.minSimilarity !== 'number'
      || !Number.isFinite(config.minSimilarity)
      || config.minSimilarity < 0
      || config.minSimilarity > 1
    )
  ) {
    throw new Error(
      'docs.duplicateCandidates.minSimilarity must be a number from 0 through 1.',
    );
  }

  for (const key of ['minWords', 'minChars', 'maxCandidates']) {
    if (
      Object.hasOwn(config, key)
      && (!Number.isInteger(config[key]) || config[key] <= 0)
    ) {
      throw new Error(`docs.duplicateCandidates.${key} must be a positive integer.`);
    }
  }

  if (Object.hasOwn(config, 'ignorePairs')) {
    if (!Array.isArray(config.ignorePairs)) {
      throw new Error('docs.duplicateCandidates.ignorePairs must be an array.');
    }

    normalizeIgnorePairs(config.ignorePairs);
  }

  const unknownKey = Object.keys(config).find((key) => !supportedKeys.has(key));

  if (unknownKey) {
    throw new Error(
      `Unsupported docs.duplicateCandidates key: ${unknownKey}. Remove it; only `
      + 'deterministic candidate settings are accepted.',
    );
  }
}

function duplicateThresholdMigrationGuidance(config) {
  const configuredWarnScore = config && typeof config === 'object'
    ? config.warnScore
    : undefined;
  const hasUsableWarnScore = configuredWarnScore !== undefined
    && configuredWarnScore !== null
    && !Number.isNaN(Number(configuredWarnScore));
  const warnScore = hasUsableWarnScore
    ? Number(configuredWarnScore)
    : retiredWarnScoreDefault;
  const minSimilarity = Math.min(warnScore, retiredCandidateThresholdCap);
  const source = hasUsableWarnScore
    ? `Configured warnScore ${warnScore}`
    : `The old default warnScore ${retiredWarnScoreDefault}`;

  return 'Preserve the old candidate threshold with '
    + 'minSimilarity = Math.min(warnScore, 0.72). '
    + `${source} maps to minSimilarity ${minSimilarity}.`;
}

function validateDuplicateCandidateOptions(options) {
  if (!['text', 'json'].includes(options.format)) {
    throw new Error('duplicate-candidates format must be text or json.');
  }

  if (
    !Number.isFinite(options.minSimilarity)
    || options.minSimilarity < 0
    || options.minSimilarity > 1
  ) {
    throw new Error('duplicateCandidates.minSimilarity must be a number from 0 through 1.');
  }

  for (const key of ['minWords', 'minChars', 'maxCandidates']) {
    if (!Number.isInteger(options[key]) || options[key] <= 0) {
      throw new Error(`duplicateCandidates.${key} must be a positive integer.`);
    }
  }

  if (!Array.isArray(options.focus)) {
    throw new Error('--focus values must be Markdown globs.');
  }

  validateRepoRelativeGlobs(options.include, 'duplicateCandidates.include');
  validateRepoRelativeGlobs(options.exclude, 'duplicateCandidates.exclude');
  validateRepoRelativeGlobs(options.focus, '--focus');
  normalizeIgnorePairs(options.ignorePairs);
}

function resolvePath(root, path) {
  return isAbsolute(path) ? path : resolve(root, path);
}
