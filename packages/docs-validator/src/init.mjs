import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { defaultConfigFile, defaultExclude, defaultInclude } from './defaults.mjs';

export const recommendedScripts = {
  'docs:markdown': 'agent-doc-rules-docs markdown',
  'docs:wording': 'agent-doc-rules-docs wording',
  'docs:security': 'agent-doc-rules-docs security',
  'docs:style': 'agent-doc-rules-docs-duplicates style',
  'docs:links': 'agent-doc-rules-docs links',
  'docs:duplicates': 'agent-doc-rules-docs-duplicates check',
  'docs:check': 'agent-doc-rules-docs check && agent-doc-rules-docs-duplicates style && agent-doc-rules-docs-duplicates check',
};

export function buildStarterConfig() {
  return {
    docs: {
      include: defaultInclude,
      exclude: defaultExclude,
      links: {
        skip: [],
        checkFragments: true,
      },
      wording: {
        writeGood: {
          passive: false,
          illusion: false,
          weasel: false,
          adverb: false,
          tooWordy: false,
          eprime: false,
          fail: false,
        },
        forbiddenTerms: [],
        allow: [],
      },
      security: {
        allow: [],
      },
      style: {
        includeReferences: false,
        minWords: 6,
        minChars: 40,
        maxUnits: 80,
        model: 'gpt-5-nano',
        reasoningEffort: 'low',
      },
      duplicates: {
        includeReferences: false,
        includeSameFile: false,
        warnScore: 0.78,
        failScore: 0.92,
        minWords: 6,
        minChars: 40,
        maxCandidates: 50,
        ignorePairs: [],
        model: 'gpt-5-nano',
        reasoningEffort: 'low',
      },
    },
  };
}

export async function runInit({
  root = process.cwd(),
  configPath,
  force = false,
  print = false,
} = {}, deps = {}) {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const resolvedRoot = resolve(root);
  const target = resolveConfigPath(resolvedRoot, configPath);
  const configText = `${JSON.stringify(buildStarterConfig(), null, 2)}\n`;
  const scriptsText = formatRecommendedScripts();

  if (print) {
    stdout.write(configText);
    stdout.write(`\nRecommended package scripts:\n${scriptsText}\n`);
    return 0;
  }

  const existing = await readFile(target, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  });

  if (existing !== null && !force) {
    stderr.write(
      `${relative(resolvedRoot, target) || defaultConfigFile} already exists. `
      + 'Use --force to overwrite it.\n',
    );
    return 1;
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, configText);

  stdout.write(`Wrote ${relative(resolvedRoot, target) || defaultConfigFile}\n`);
  stdout.write(`\nRecommended package scripts:\n${scriptsText}\n`);

  return 0;
}

export function formatRecommendedScripts() {
  return `${JSON.stringify({ scripts: recommendedScripts }, null, 2)}\n`;
}

function resolveConfigPath(root, configPath) {
  if (!configPath) {
    return resolve(root, defaultConfigFile);
  }

  return isAbsolute(configPath) ? configPath : resolve(root, configPath);
}
