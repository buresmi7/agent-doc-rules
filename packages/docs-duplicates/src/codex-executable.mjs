import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import crossSpawn from 'cross-spawn';

const minimumCodexVersionParts = [0, 142, 0];

export const minimumCodexVersion = minimumCodexVersionParts.join('.');

export function resolveCodexExecutable({ codexBin, root } = {}, dependencies = {}) {
  const probeCodex = dependencies.probeCodex ?? probeCodexExecutable;
  const resolveLocalCodex = dependencies.resolveLocalCodex ?? resolveLocalCodexExecutable;

  if (codexBin !== undefined && codexBin !== null) {
    if (typeof codexBin !== 'string' || codexBin.trim() === '') {
      throw createCodexResolutionError([
        'Explicit Codex executable: the configured value must be a non-empty string.',
      ], { explicit: true });
    }

    const explicitCandidate = { command: codexBin, args: [] };
    const explicitResult = probeCodexCandidate(explicitCandidate, probeCodex);

    if (explicitResult.compatible) {
      return explicitCandidate;
    }

    throw createCodexResolutionError([
      `Explicit Codex executable ${JSON.stringify(codexBin)}: ${explicitResult.detail}`,
    ], { explicit: true });
  }

  const attempts = [];
  const pathCandidate = { command: 'codex', args: [] };
  const pathResult = probeCodexCandidate(pathCandidate, probeCodex);

  if (pathResult.compatible) {
    return pathCandidate;
  }

  attempts.push(`PATH \`codex\`: ${pathResult.detail}`);

  let localCandidate;

  try {
    localCandidate = resolveLocalCodex({ root: resolve(root ?? process.cwd()) });
  } catch (error) {
    attempts.push(`Project-local @openai/codex: could not be resolved (${formatError(error)}).`);
    throw createCodexResolutionError(attempts);
  }

  if (localCandidate) {
    const localResult = probeCodexCandidate(localCandidate, probeCodex);

    if (localResult.compatible) {
      return localCandidate;
    }

    attempts.push(`Project-local @openai/codex: ${localResult.detail}`);
  } else {
    attempts.push('Project-local @openai/codex: not installed.');
  }

  throw createCodexResolutionError(attempts);
}

export function probeCodexExecutable(candidate) {
  return crossSpawn.sync(
    candidate.command,
    [...candidate.args, '--version'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
      timeout: 5_000,
      windowsHide: true,
    },
  );
}

export function resolveLocalCodexExecutable({ root = process.cwd() } = {}) {
  const binPath = resolveCodexBin({ root });

  if (!binPath) {
    return null;
  }

  return {
    command: process.execPath,
    args: [binPath],
  };
}

export function resolveCodexBin({ root = process.cwd() } = {}) {
  for (const packageJsonPath of resolvePackageJsonPaths('@openai/codex', { root })) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const bin = typeof packageJson.bin === 'string'
      ? packageJson.bin
      : packageJson.bin?.codex;

    if (!bin) {
      continue;
    }

    const binPath = join(dirname(packageJsonPath), bin);

    if (existsSync(binPath)) {
      return binPath;
    }
  }

  return undefined;
}

export function resolvePackageJsonPaths(packageName, { root = process.cwd() } = {}) {
  const resolvedRoot = resolve(root);
  const packageJsonPaths = [];

  let directory = resolvedRoot;

  while (true) {
    const candidate = join(directory, 'node_modules', packageName, 'package.json');

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

function probeCodexCandidate(candidate, probeCodex) {
  try {
    return inspectCodexProbe(probeCodex(candidate));
  } catch (error) {
    return {
      compatible: false,
      detail: `could not be run (${formatError(error)}).`,
    };
  }
}

function inspectCodexProbe(result) {
  if (result?.error) {
    if (result.error.code === 'ENOENT') {
      return { compatible: false, detail: 'not found.' };
    }

    if (result.error.code === 'ETIMEDOUT') {
      return { compatible: false, detail: 'could not be run because the version check timed out.' };
    }

    return {
      compatible: false,
      detail: `could not be run (${result.error.message}).`,
    };
  }

  if (result?.status !== 0) {
    const detail = formatProbeOutput(result);
    const suffix = detail ? `: ${detail}` : '.';

    return {
      compatible: false,
      detail: `could not be run successfully (exit code ${result?.status ?? 'unknown'})${suffix}`,
    };
  }

  const output = formatProbeOutput(result);
  const version = parseCodexVersion(output);

  if (!version) {
    return {
      compatible: false,
      detail: 'returned an unrecognized version; expected output such as "codex-cli 0.142.0".',
    };
  }

  if (!isSupportedCodexVersion(version)) {
    return {
      compatible: false,
      detail: `found ${version.value}; upgrade to ${minimumCodexVersion} or later.`,
    };
  }

  return { compatible: true, detail: `found ${version.value}.` };
}

function parseCodexVersion(output) {
  const matches = output
    .split(/\r?\n/)
    .map((line) => line.trim().match(
      /^codex(?:-cli)?[ \t]+v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/i,
    ))
    .filter(Boolean);

  if (matches.length !== 1) {
    return null;
  }

  const [match] = matches;
  const parts = match.slice(1, 4).map(Number);

  if (!parts.every(Number.isSafeInteger)) {
    return null;
  }

  return {
    value: `${parts.join('.')}${match[4] ?? ''}${match[5] ?? ''}`,
    parts,
    prerelease: Boolean(match[4]),
  };
}

function isSupportedCodexVersion(version) {
  for (let index = 0; index < minimumCodexVersionParts.length; index += 1) {
    if (version.parts[index] > minimumCodexVersionParts[index]) {
      return true;
    }

    if (version.parts[index] < minimumCodexVersionParts[index]) {
      return false;
    }
  }

  return !version.prerelease;
}

function formatProbeOutput(result) {
  return [result?.stdout, result?.stderr]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

function createCodexResolutionError(attempts, { explicit = false } = {}) {
  const heading = explicit
    ? 'The explicit Codex CLI executable is not compatible.'
    : 'No compatible Codex CLI executable is available.';
  const explicitNote = explicit
    ? `\nThe explicit selection is authoritative, so PATH and local fallbacks were not tried.
Update that executable, or remove --codex-bin or the matching codexBin config
value to enable PATH and project-local fallback resolution.\n`
    : '';

  return new Error(`${heading}
Codex CLI ${minimumCodexVersion} or later is required.

Checked:
${attempts.map((attempt) => `- ${attempt}`).join('\n')}
${explicitNote}
Install or update Codex on PATH:
  npm install --global @openai/codex@latest

Or install the opt-in project-local fallback:
  npm install --save-dev @openai/codex

Authenticate the selected CLI with \`codex login\` and verify it with
\`codex login status\`. Reviews also require network access to the configured
model provider and account access to the selected model.

Use --codex-bin, docs.duplicates.codexBin, or docs.style.codexBin to select a
specific executable. This package does not download Codex automatically.`);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
