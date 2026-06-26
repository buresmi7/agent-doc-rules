import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export const codexOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          status: { type: 'string', enum: ['fail', 'warn', 'ok'] },
          reason: { type: 'string' },
        },
        required: ['id', 'score', 'status', 'reason'],
      },
    },
  },
  required: ['matches'],
};

export const styleOutputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['fail', 'warn', 'ok'] },
          category: {
            type: 'string',
            enum: ['unclear', 'idiom', 'vague', 'ai-voice', 'too-long', 'passive', 'ok'],
          },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['id', 'status', 'category', 'issue', 'suggestion', 'confidence'],
      },
    },
  },
  required: ['findings'],
};

export async function runCodexClassifier(candidates, {
  root,
  model,
  reasoningEffort,
  codexBin,
} = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'docs-duplicates-codex-'));
  const schemaFile = join(tempDir, 'schema.json');
  const outputFile = join(tempDir, 'last-message.json');

  try {
    await writeFile(schemaFile, JSON.stringify(codexOutputSchema, null, 2));
    const prompt = buildCodexPrompt(candidates);
    const invocation = buildCodexInvocation({
      root,
      model,
      reasoningEffort,
      codexBin,
      schemaFile,
      outputFile,
    });

    await runCodex(invocation, prompt);
    return parseCodexResponse(await readFile(outputFile, 'utf8'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function runCodexStyleReviewer(units, {
  root,
  model,
  reasoningEffort,
  codexBin,
} = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'docs-style-codex-'));
  const schemaFile = join(tempDir, 'schema.json');
  const outputFile = join(tempDir, 'last-message.json');

  try {
    await writeFile(schemaFile, JSON.stringify(styleOutputSchema, null, 2));
    const prompt = buildStylePrompt(units);
    const invocation = buildCodexInvocation({
      root,
      model,
      reasoningEffort,
      codexBin,
      schemaFile,
      outputFile,
    });

    await runCodex(invocation, prompt);
    return parseCodexResponse(await readFile(outputFile, 'utf8'));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function buildCodexPrompt(candidates) {
  const formattedCandidates = candidates.map((candidate) => `## ${candidate.id}

Heuristic score: ${candidate.score.toFixed(3)}
Heuristic reason: ${candidate.reason}

Left: ${candidate.left.file}:${candidate.left.line}
${candidate.left.text}

Right: ${candidate.right.file}:${candidate.right.line}
${candidate.right.text}`).join('\n\n');

  return `You are reviewing a small list of possible duplicate documentation passages.

Classify only the candidate pairs shown below. Do not inspect the repository or
invent additional pairs.

Use these labels:

- fail: the passages repeat the same durable rule, fact, or procedure and one
  should be deduplicated.
- warn: the passages overlap enough for a maintainer to review, but the
  duplication may be acceptable.
- ok: the passages are not a meaningful duplicate.

Use warn, not fail, when repetition appears intentional in README summaries,
templates, E2E fixtures, E2E criteria, reference indexes, or short routing
pointers.

Return JSON matching the provided schema. Use score as duplicate confidence from
0.0 to 1.0.

# Candidate Pairs

${formattedCandidates}`;
}

export function buildStylePrompt(units) {
  const formattedUnits = units.map((unit) => `## ${unit.id}

Location: ${unit.file}:${unit.line}
${unit.text}`).join('\n\n');

  return `You are reviewing repository documentation sentence by sentence.

Review only the sentences listed below. Do not inspect the repository and do not
invent findings for text that is not shown.

Use these labels:

- fail: the sentence has a clear style problem that should block documentation
  changes, such as an unclear idiom, metaphorical workflow name, vague AI-like
  phrasing, or wording that makes the task hard to understand.
- warn: the sentence is understandable but a maintainer should consider a
  clearer rewrite.
- ok: the sentence is clear enough for repository documentation.

Prefer concrete wording. Be strict about workflow, process, and section names
that sound clever but do not explain the task. Do not flag paths, commands,
package names, code identifiers, or necessary technical terms.

Return only findings that are fail or warn. If every sentence is ok, return an
empty findings array. Use confidence from 0.0 to 1.0.

# Sentences

${formattedUnits}`;
}

export function buildCodexInvocation({
  root,
  model,
  reasoningEffort,
  codexBin,
  schemaFile,
  outputFile,
}) {
  const args = [
    'exec',
    '--skip-git-repo-check',
    '--ephemeral',
    '--ignore-rules',
    '--sandbox',
    'read-only',
    '--model',
    model,
    '--config',
    `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`,
    '--output-schema',
    schemaFile,
    '--output-last-message',
    outputFile,
    '--color',
    'never',
    '--cd',
    root,
    '-',
  ];

  if (codexBin) {
    return { command: codexBin, args };
  }

  return {
    command: process.execPath,
    args: [resolveCodexBin(), ...args],
  };
}

export function resolveCodexBin() {
  for (const packageJsonPath of resolvePackageJsonPaths('@openai/codex')) {
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

  throw new Error('@openai/codex does not expose a codex binary.');
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

export function parseCodexResponse(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);

    if (fenced) {
      return JSON.parse(fenced[1]);
    }

    throw new Error('Codex did not return valid duplicate-check JSON.');
  }
}

function runCodex({ command, args }, prompt) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NO_COLOR: process.env.NO_COLOR ?? '1',
      },
    });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n');
        reject(new Error(`Codex duplicate review failed with exit code ${code ?? 1}.\n${detail}`));
      }
    });

    child.stdin.end(prompt);
  });
}
