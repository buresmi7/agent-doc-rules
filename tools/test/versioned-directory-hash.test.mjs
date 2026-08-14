import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import test from 'node:test';

import { computeVersionedDirectoryHash } from '../versioned-directory-hash.mjs';

const execFileAsync = promisify(execFile);

test('computeVersionedDirectoryHash includes versioned source and excludes ignored output', async (t) => {
  const repoRoot = await mkdtemp(join(tmpdir(), 'versioned-directory-hash-'));
  const directory = join(repoRoot, 'skill');

  t.after(() => rm(repoRoot, { recursive: true, force: true }));

  await mkdir(join(directory, 'ignored'), { recursive: true });
  await writeFile(join(repoRoot, '.gitignore'), 'skill/ignored/\n');
  await writeFile(join(directory, 'SKILL.md'), 'tracked\n');
  await writeFile(join(directory, 'reference.md'), 'untracked\n');
  await writeFile(join(directory, 'ignored', 'report.json'), 'first\n');
  await symlink(directory, join(directory, 'ignored', 'workspace-back-link'), directorySymlinkType());
  await execFileAsync('git', ['init', '--quiet'], { cwd: repoRoot });
  await execFileAsync('git', ['add', '.gitignore', 'skill/SKILL.md'], { cwd: repoRoot });

  const initialHash = await computeVersionedDirectoryHash(repoRoot, directory);
  const expectedHash = createHash('sha256')
    .update('reference.md')
    .update('untracked\n')
    .update('SKILL.md')
    .update('tracked\n')
    .digest('hex');

  assert.equal(initialHash, expectedHash);

  await writeFile(join(directory, 'ignored', 'report.json'), 'second\n');
  assert.equal(await computeVersionedDirectoryHash(repoRoot, directory), initialHash);

  await writeFile(join(directory, 'SKILL.md'), 'changed\n');
  assert.notEqual(await computeVersionedDirectoryHash(repoRoot, directory), initialHash);
});

function directorySymlinkType() {
  return process.platform === 'win32' ? 'junction' : 'dir';
}
