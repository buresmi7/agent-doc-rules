import { spawn } from 'node:child_process';

export function runCommand(command, args, input, options = {}) {
  return runCommandCapture(command, args, input, options).then((result) => {
    if (result.code === 0) {
      return { stdout: result.stdout, stderr: result.stderr };
    }

    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.code}\n${result.stderr}\n${result.stdout}`);
  });
}

export function runCommandCapture(command, args, input, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const { env, ...spawnOptions } = options;
    const child = spawn(command, args, {
      ...spawnOptions,
      env: env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, stdout, stderr });
    });

    child.stdin.end(input ?? '');
  });
}

export function parseJsonOutput(value, label) {
  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fenced) {
      return JSON.parse(fenced[1]);
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
  }

  throw new Error(`${label} did not contain valid JSON: ${trimmed}`);
}
