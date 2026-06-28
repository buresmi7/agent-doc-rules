import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import {
  defaultConfigFile,
  defaultExclude,
  defaultInclude,
  duplicateDefaults,
  styleDefaults,
} from './defaults.mjs';

export async function loadDocsConfig({ root = process.cwd(), configPath } = {}) {
  const resolvedRoot = resolve(root);
  const resolvedConfigPath = configPath
    ? resolvePath(resolvedRoot, configPath)
    : resolve(resolvedRoot, defaultConfigFile);

  try {
    const raw = await readFile(resolvedConfigPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.docs ?? parsed;
  } catch (error) {
    if (error.code === 'ENOENT' && !configPath) {
      return {};
    }

    throw error;
  }
}

export async function resolveDuplicateOptions(flags = {}) {
  const root = resolve(flags.root ?? process.cwd());
  const config = await loadDocsConfig({ root, configPath: flags.configPath });
  const duplicateConfig = config.duplicates ?? {};

  return {
    root,
    include: chooseArray(flags.include, duplicateConfig.include, config.include, defaultInclude),
    exclude: chooseArray(flags.exclude, duplicateConfig.exclude, config.exclude, defaultExclude),
    includeReferences: flags.includeReferences ?? duplicateConfig.includeReferences ?? duplicateDefaults.includeReferences,
    includeSameFile: flags.includeSameFile ?? duplicateConfig.includeSameFile ?? duplicateDefaults.includeSameFile,
    ignorePairs: chooseArray(duplicateConfig.ignorePairs, duplicateDefaults.ignorePairs),
    warnScore: chooseNumber(flags.warnScore, duplicateConfig.warnScore, duplicateDefaults.warnScore),
    failScore: chooseNumber(flags.failScore, duplicateConfig.failScore, duplicateDefaults.failScore),
    minWords: chooseNumber(flags.minWords, duplicateConfig.minWords, duplicateDefaults.minWords),
    minChars: chooseNumber(flags.minChars, duplicateConfig.minChars, duplicateDefaults.minChars),
    maxCandidates: chooseNumber(flags.maxCandidates, duplicateConfig.maxCandidates, duplicateDefaults.maxCandidates),
    model: flags.model ?? duplicateConfig.model ?? duplicateDefaults.model,
    reasoningEffort: flags.reasoningEffort ?? duplicateConfig.reasoningEffort ?? duplicateDefaults.reasoningEffort,
    codexBin: flags.codexBin ?? duplicateConfig.codexBin,
  };
}

export async function resolveStyleOptions(flags = {}) {
  const root = resolve(flags.root ?? process.cwd());
  const config = await loadDocsConfig({ root, configPath: flags.configPath });
  const styleConfig = config.style ?? {};

  return {
    root,
    include: chooseArray(flags.include, styleConfig.include, config.include, defaultInclude),
    exclude: chooseArray(flags.exclude, styleConfig.exclude, config.exclude, defaultExclude),
    includeReferences: flags.includeReferences ?? styleConfig.includeReferences ?? styleDefaults.includeReferences,
    minWords: chooseNumber(flags.minWords, styleConfig.minWords, styleDefaults.minWords),
    minChars: chooseNumber(flags.minChars, styleConfig.minChars, styleDefaults.minChars),
    maxUnits: chooseNumber(flags.maxUnits, styleConfig.maxUnits, styleDefaults.maxUnits),
    model: flags.model ?? styleConfig.model ?? styleDefaults.model,
    reasoningEffort: flags.reasoningEffort ?? styleConfig.reasoningEffort ?? styleDefaults.reasoningEffort,
    codexBin: flags.codexBin ?? styleConfig.codexBin,
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

function chooseNumber(...candidates) {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && !Number.isNaN(Number(candidate))) {
      return Number(candidate);
    }
  }

  return undefined;
}

function resolvePath(root, path) {
  return isAbsolute(path) ? path : resolve(root, path);
}
