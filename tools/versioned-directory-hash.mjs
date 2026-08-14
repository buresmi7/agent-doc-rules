import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function computeVersionedDirectoryHash(repoRoot, directory) {
  const sourcePath = relative(repoRoot, directory).replaceAll('\\', '/');

  if (sourcePath === '..' || sourcePath.startsWith('../')) {
    throw new Error(`Directory must be inside the Git worktree: ${directory}`);
  }

  const { stdout } = await execFileAsync('git', [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    sourcePath,
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const files = stdout
    .split('\0')
    .filter(Boolean)
    .map((path) => {
      const absolutePath = resolve(repoRoot, path);
      const relativePath = relative(directory, absolutePath).replaceAll('\\', '/');

      if (relativePath === '..' || relativePath.startsWith('../')) {
        throw new Error(`Git returned a file outside ${directory}: ${path}`);
      }

      return { absolutePath, relativePath };
    })
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const hash = createHash('sha256');

  for (const file of files) {
    const content = await readFile(file.absolutePath).catch((error) => {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        return undefined;
      }

      throw error;
    });

    if (content !== undefined) {
      hash.update(file.relativePath);
      hash.update(content);
    }
  }

  return hash.digest('hex');
}
