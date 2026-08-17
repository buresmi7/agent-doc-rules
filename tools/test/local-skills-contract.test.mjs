import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { repoRoot } from '../release-metadata.mjs';

const packageDir = join(repoRoot, 'packages/agent-doc-rules-skill');
const expectedSkills = ['agent-doc-rules', 'docs-duplicate-review'];

test('the published package declares and contains both local skills', async () => {
  const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));

  assert.deepEqual(manifest.agentDocRules?.localSkills, expectedSkills);
  assert.ok(manifest.files?.includes('skills'));
  assert.equal(manifest.files?.includes('SKILL.md'), false);

  for (const name of expectedSkills) {
    await access(join(packageDir, 'skills', name, 'SKILL.md'));
  }

  await assert.rejects(access(join(packageDir, 'SKILL.md')), { code: 'ENOENT' });
});

test('skills-lock tracks each local skill directory independently', async () => {
  const lock = JSON.parse(await readFile(join(repoRoot, 'skills-lock.json'), 'utf8'));
  const localNames = Object.entries(lock.skills ?? {})
    .filter(([, entry]) => entry.sourceType === 'local')
    .map(([name]) => name)
    .sort();

  assert.deepEqual(localNames, [...expectedSkills].sort());

  for (const name of expectedSkills) {
    const entry = lock.skills?.[name];

    assert.equal(entry?.sourceType, 'local');
    assert.equal(
      entry?.source,
      `packages/agent-doc-rules-skill/skills/${name}`,
    );
    assert.match(entry?.computedHash ?? '', /^[0-9a-f]{64}$/);
  }
});
