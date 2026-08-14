import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crossSpawn from 'cross-spawn';
import { resolveCodexExecutable } from './codex-executable.mjs';

export {
  minimumCodexVersion,
  probeCodexExecutable,
  resolveCodexBin,
  resolveCodexExecutable,
  resolveLocalCodexExecutable,
  resolvePackageJsonPaths,
} from './codex-executable.mjs';

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
} = {}, dependencies = {}) {
  const codexExecutable = resolveCodexExecutable({ codexBin, root }, dependencies);
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
      codexExecutable,
      schemaFile,
      outputFile,
    });

    await runCodex(invocation, prompt, dependencies.spawn);
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
} = {}, dependencies = {}) {
  const codexExecutable = resolveCodexExecutable({ codexBin, root }, dependencies);
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
      codexExecutable,
      schemaFile,
      outputFile,
    });

    await runCodex(invocation, prompt, dependencies.spawn);
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
  codexExecutable,
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

  const executable = codexExecutable ?? {
    command: codexBin ?? 'codex',
    args: [],
  };

  return {
    command: executable.command,
    args: [...executable.args, ...args],
  };
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

    throw new Error('Codex did not return valid documentation-review JSON.');
  }
}

function runCodex({ command, args }, prompt, spawnProcess = crossSpawn) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let stdinError;
    let settled = false;
    const child = spawnProcess(command, args, {
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
    child.stdin.on('error', (error) => {
      stdinError = error;
    });
    child.on('error', (error) => {
      settle(reject, new Error(
        `Codex documentation review could not be started (${error.message}).`,
        { cause: error },
      ));
    });
    child.on('close', (code, signal) => {
      if (code === 0 && !stdinError) {
        settle(resolve);
        return;
      }

      const outcome = signal
        ? `was terminated by signal ${signal}`
        : code === 0
          ? 'failed while writing the prompt'
          : `failed with exit code ${code ?? 'unknown'}`;
      const detail = [
        stdinError ? `Prompt input error: ${stdinError.message}` : '',
        stderr.trim(),
        stdout.trim(),
      ].filter(Boolean).join('\n');
      const suffix = detail ? `\n${detail}` : '';
      settle(reject, new Error(`Codex documentation review ${outcome}.${suffix}`));
    });

    try {
      child.stdin.end(prompt);
    } catch (error) {
      settle(reject, new Error(
        `Codex documentation review failed while writing the prompt (${error.message}).`,
        { cause: error },
      ));
    }

    function settle(callback, value) {
      if (settled) {
        return;
      }

      settled = true;
      callback(value);
    }
  });
}
