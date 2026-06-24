import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { defaultConfigFile, defaultExclude, defaultInclude } from './defaults.mjs';

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

export async function resolveDocsOptions({
  command = 'markdown',
  root = process.cwd(),
  configPath,
  include = [],
  exclude = [],
  skip = [],
  checkFragments,
} = {}) {
  const resolvedRoot = resolve(root);
  const config = await loadDocsConfig({ root: resolvedRoot, configPath });
  const commandConfig = config[command] ?? {};
  const linkConfig = command === 'links' ? (config.links ?? {}) : {};

  return {
    root: resolvedRoot,
    include: chooseArray(include, commandConfig.include, config.include, defaultInclude),
    exclude: chooseArray(exclude, commandConfig.exclude, config.exclude, defaultExclude),
    skip: chooseArray(skip, linkConfig.skip, commandConfig.skip, []),
    checkFragments: checkFragments ?? linkConfig.checkFragments ?? commandConfig.checkFragments ?? true,
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

function resolvePath(root, path) {
  return isAbsolute(path) ? path : resolve(root, path);
}
