import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const changesetsCli = require.resolve('@changesets/cli/bin.js');

const publicPackages = [
  ['@buresmi7/agent-doc-rules-skill', 'agent-doc-rules-skill'],
  ['@buresmi7/agent-e2e-runner', 'agent-e2e-runner'],
  ['@buresmi7/agent-e2e-report', 'agent-e2e-report'],
  ['@buresmi7/agent-doc-rules-docs-validator', 'docs-validator'],
];

test('Changesets versions only the package named by a changeset', async (context) => {
  const fixture = await mkdtemp(join(tmpdir(), 'agent-doc-rules-changesets-'));
  context.after(() => rm(fixture, { recursive: true, force: true }));

  await mkdir(join(fixture, '.changeset'), { recursive: true });
  await mkdir(join(fixture, 'packages'), { recursive: true });
  await symlink(join(repoRoot, 'node_modules'), join(fixture, 'node_modules'), 'dir');

  await writeJson(join(fixture, 'package.json'), {
    name: 'changesets-independent-fixture',
    version: '0.11.0',
    private: true,
  });
  await writeFile(
    join(fixture, 'pnpm-workspace.yaml'),
    'packages:\n  - "packages/*"\n',
  );
  await writeJson(join(fixture, '.changeset/config.json'), {
    changelog: '@changesets/cli/changelog',
    commit: false,
    fixed: [],
    linked: [],
    access: 'public',
    baseBranch: 'master',
    updateInternalDependencies: 'patch',
    ignore: [],
    privatePackages: {
      version: false,
      tag: false,
    },
  });
  await writeFile(
    join(fixture, '.changeset/only-skill.md'),
    [
      '---',
      '"@buresmi7/agent-doc-rules-skill": patch',
      '---',
      '',
      'Verify independent package versioning.',
      '',
    ].join('\n'),
  );

  for (const [name, directory] of publicPackages) {
    const packageDir = join(fixture, 'packages', directory);
    await mkdir(packageDir, { recursive: true });
    await writeJson(join(packageDir, 'package.json'), {
      name,
      version: '0.11.0',
      private: false,
    });
    await writeFile(
      join(packageDir, 'CHANGELOG.md'),
      '# Changelog\n\n## 0.11.0\n\n- Baseline.\n',
    );
  }

  await run(process.execPath, [changesetsCli, 'version'], {
    cwd: fixture,
  });

  const rootManifest = await readJson(join(fixture, 'package.json'));
  assert.equal(rootManifest.version, '0.11.0');

  for (const [name, directory] of publicPackages) {
    const packageDir = join(fixture, 'packages', directory);
    const manifest = await readJson(join(packageDir, 'package.json'));
    const changelog = await readFile(join(packageDir, 'CHANGELOG.md'), 'utf8');
    const expectedVersion = name === '@buresmi7/agent-doc-rules-skill'
      ? '0.11.1'
      : '0.11.0';

    assert.equal(manifest.version, expectedVersion, name);
    assert.match(changelog, new RegExp(`^## ${expectedVersion.replaceAll('.', '\\.')}\\b`, 'm'));
  }

  await assert.rejects(
    readFile(join(fixture, '.changeset/only-skill.md'), 'utf8'),
    { code: 'ENOENT' },
  );
});

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
