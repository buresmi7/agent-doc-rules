import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = join(packageRoot, 'skills');
const skillNames = [
  'agent-doc-rules',
  'docs-duplicate-review',
];

test('publishes exactly two standard skill directories', async () => {
  const entries = await readdir(skillsRoot, { withFileTypes: true });

  assert.deepEqual(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
    skillNames,
  );

  for (const skillName of skillNames) {
    const skill = await readFile(join(skillsRoot, skillName, 'SKILL.md'), 'utf8');

    assert.match(skill, new RegExp(`^name: ${skillName}$`, 'm'));
    assert.match(skill, /^description: .+$/m);
  }
});

test('declares both local skills for repository tooling', async () => {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));

  assert.deepEqual(manifest.agentDocRules?.localSkills, skillNames);
  assert.ok(manifest.files.includes('skills'));
  assert.ok(manifest.files.includes('docs'));
  assert.ok(!manifest.files.includes('SKILL.md'));
  assert.ok(!manifest.files.includes('references'));
});

test('keeps style review in agent-doc-rules through progressive disclosure', async () => {
  const skill = await readFile(
    join(skillsRoot, 'agent-doc-rules/SKILL.md'),
    'utf8',
  );
  const writingStyle = await readFile(
    join(skillsRoot, 'agent-doc-rules/references/writing-style.md'),
    'utf8',
  );

  assert.match(skill, /documentation writing, rewriting, or style (?:cleanup|review)/);
  assert.match(skill, /references\/writing-style\.md/);
  assert.match(writingStyle, /## Structured Style Review/);
});

test('duplicate review uses deterministic candidates and host-agent judgment', async () => {
  const skill = await readFile(
    join(skillsRoot, 'docs-duplicate-review/SKILL.md'),
    'utf8',
  );
  const rubric = await readFile(
    join(skillsRoot, 'docs-duplicate-review/references/classification-rubric.md'),
    'utf8',
  );

  assert.match(skill, /agent-doc-rules-docs duplicate-candidates --format json/);
  assert.match(skill, /references\/classification-rubric\.md/);
  assert.match(skill, /host agent/i);
  assert.match(rubric, /`fail`/);
  assert.match(rubric, /`warn`/);
  assert.match(rubric, /`ok`/);
});

test('public current docs require no secondary AI tool', async () => {
  const paths = [
    join(packageRoot, 'README.md'),
    ...await markdownPaths(skillsRoot),
  ];
  const forbiddenEverywhere = [
    /Codex CLI/i,
    /separately installed and authenticated/i,
  ];
  const retiredRuntimeTerms = [
    /@openai\/codex/,
    /agent-doc-rules-docs-duplicates/,
    /codexBin/,
    /reasoningEffort/,
  ];
  const migrationPath = join(
    packageRoot,
    'docs/adoption.md',
  );

  for (const path of paths) {
    const content = await readFile(path, 'utf8');

    for (const pattern of forbiddenEverywhere) {
      assert.doesNotMatch(content, pattern, `${path} contains ${pattern}`);
    }

    if (path !== migrationPath) {
      for (const pattern of retiredRuntimeTerms) {
        assert.doesNotMatch(content, pattern, `${path} contains ${pattern}`);
      }
    }
  }

  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /pnpm remove @buresmi7\/agent-doc-rules-docs-duplicates/);
  assert.match(migration, /pnpm remove @openai\/codex/);
  assert.match(migration, /docs:duplicate-candidates/);
  assert.match(migration, /\$agent-doc-rules/);
  assert.match(migration, /\$docs-duplicate-review/);
});

async function markdownPaths(directory) {
  const paths = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...await markdownPaths(path));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      paths.push(path);
    }
  }

  return paths;
}
