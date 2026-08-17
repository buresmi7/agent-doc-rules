import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';

import { defaultExclude, defaultInclude } from '../../packages/docs-validator/src/defaults.mjs';
import {
  checkRepositorySelfCompliance,
  collectPersistedExceptions,
} from '../check-self-compliance.mjs';

test('the repository follows its own documentation and skill contracts', async () => {
  assert.deepEqual(await checkRepositorySelfCompliance(), []);
});

test('exception discovery finds every persistent suppression', () => {
  const ignorePair = {
    left: '^fixtures/example\\.md$',
    right: '^docs/rules\\.md$',
    reason: 'Fixture prose repeats the canonical rule.',
  };
  const config = {
    docs: {
      include: ['README.md'],
      exclude: [...defaultExclude, 'generated/**'],
      links: {
        include: ['README.md'],
        exclude: [...defaultExclude, 'generated/**', 'fixtures/links.md'],
        skip: ['^https://example\\.invalid'],
        checkFragments: false,
      },
      wording: {
        writeGood: false,
        allow: ['intentional wording'],
      },
      security: {
        allow: ['intentional example'],
      },
      duplicateCandidates: {
        ignorePairs: [ignorePair],
        minSimilarity: 0.9,
        minWords: 12,
        minChars: 80,
      },
    },
  };

  const expected = [
    {
      setting: 'docs.duplicateCandidates.ignorePairs',
      value: { left: ignorePair.left, right: ignorePair.right },
    },
    { setting: 'docs.duplicateCandidates.minChars', value: 80 },
    { setting: 'docs.duplicateCandidates.minSimilarity', value: 0.9 },
    { setting: 'docs.duplicateCandidates.minWords', value: 12 },
    { setting: 'docs.include', value: ['README.md'] },
    { setting: 'docs.exclude', value: 'generated/**' },
    { setting: 'docs.links.checkFragments', value: false },
    { setting: 'docs.links.exclude', value: 'fixtures/links.md' },
    { setting: 'docs.links.include', value: ['README.md'] },
    { setting: 'docs.links.skip', value: '^https://example\\.invalid' },
    { setting: 'docs.security.allow', value: 'intentional example' },
    { setting: 'docs.wording.allow', value: 'intentional wording' },
    { setting: 'docs.wording.writeGood', value: false },
  ];
  const actual = collectPersistedExceptions(config);

  assert.equal(actual.length, expected.length);
  assert.deepEqual(new Set(actual.map(JSON.stringify)), new Set(expected.map(JSON.stringify)));
});

test('unregistered persistent suppressions fail repository governance', async (context) => {
  const root = await createFixture(context);
  const config = await readJson(join(root, 'agent-doc-rules.config.json'));
  const ignorePair = {
    left: '^fixtures/example\\.md$',
    right: '^docs/rules\\.md$',
    reason: 'Fixture prose repeats the canonical rule.',
  };

  config.docs.exclude.push('generated/**');
  config.docs.include = ['README.md'];
  config.docs.links = {
    include: ['README.md'],
    exclude: [...config.docs.exclude, 'fixtures/links.md'],
    skip: ['^https://example\\.invalid(?:/|$)'],
  };
  config.docs.wording = { writeGood: false };
  config.docs.duplicateCandidates.ignorePairs = [ignorePair];
  config.docs.duplicateCandidates.minSimilarity = 0.9;
  config.docs.duplicateCandidates.minWords = 12;
  config.docs.duplicateCandidates.minChars = 80;
  await writeJson(join(root, 'agent-doc-rules.config.json'), config);

  const errors = await checkRepositorySelfCompliance(root);

  for (const setting of [
    'docs.exclude',
    'docs.include',
    'docs.links.include',
    'docs.links.exclude',
    'docs.links.skip',
    'docs.wording.writeGood',
    'docs.duplicateCandidates.ignorePairs',
    'docs.duplicateCandidates.minSimilarity',
    'docs.duplicateCandidates.minWords',
    'docs.duplicateCandidates.minChars',
  ]) {
    assert.ok(
      errors.some((error) => error.includes(`Unregistered config exception ${setting}:`)),
      `Expected an unregistered exception error for ${setting}:\n${errors.join('\n')}`,
    );
  }
});

test('a governed ignore pair accepts an ordinary reason and requires narrow anchors', async (context) => {
  await context.test('ordinary reason with a governed decision passes', async (subtest) => {
    const root = await createFixture(subtest);
    const config = await readJson(join(root, 'agent-doc-rules.config.json'));
    const pair = {
      left: '^fixtures/example\\.md$',
      right: '^docs/rules\\.md$',
      reason: 'Fixture prose repeats the canonical rule.',
    };

    config.docs.duplicateCandidates.ignorePairs = [pair];
    config.governance.exceptions.push(governanceEntry(
      'docs.duplicateCandidates.ignorePairs',
      { left: pair.left, right: pair.right },
    ));
    await writeJson(join(root, 'agent-doc-rules.config.json'), config);

    assert.deepEqual(await checkRepositorySelfCompliance(root), []);
  });

  for (const pattern of [
    '^fixtures/',
    '^[^]*$',
    '^.{0,999999}$',
    '^(?!README|docs/development)[^]*$',
  ]) {
    await context.test(`${pattern} is rejected as broad`, async (subtest) => {
      const root = await createFixture(subtest);
      const config = await readJson(join(root, 'agent-doc-rules.config.json'));
      const pair = {
        left: pattern,
        right: '^docs/rules\\.md$',
        reason: 'Fixture prose repeats the canonical rule.',
      };

      config.docs.duplicateCandidates.ignorePairs = [pair];
      config.governance.exceptions.push(governanceEntry(
        'docs.duplicateCandidates.ignorePairs',
        { left: pair.left, right: pair.right },
      ));
      await writeJson(join(root, 'agent-doc-rules.config.json'), config);

      const errors = await checkRepositorySelfCompliance(root);
      assert.ok(errors.some((error) => error.includes('ignorePairs left pattern must be narrow')));
    });
  }
});

test('equivalent broad link skip regexes are rejected', async (context) => {
  for (const pattern of [
    '^https?:',
    '^.+$',
    '^https://(?!example\\.com)',
    '^https://example\\.com$|^https://.*',
  ]) {
    await context.test(pattern, async (subtest) => {
      const root = await createFixture(subtest);
      const config = await readJson(join(root, 'agent-doc-rules.config.json'));

      config.docs.links = { skip: [pattern] };
      config.governance.exceptions.push(governanceEntry('docs.links.skip', pattern));
      await writeJson(join(root, 'agent-doc-rules.config.json'), config);

      const errors = await checkRepositorySelfCompliance(root);
      assert.ok(
        errors.includes(`Link skip pattern is too broad: ${pattern}.`),
        `Expected broad link skip error for ${pattern}:\n${errors.join('\n')}`,
      );
    });
  }
});

test('phase excludes must repeat non-default shared exclusions', async (context) => {
  const root = await createFixture(context);
  const config = await readJson(join(root, 'agent-doc-rules.config.json'));

  config.docs.exclude.push('generated/**');
  config.docs.security = { exclude: [...defaultExclude] };
  config.governance.exceptions.push(governanceEntry('docs.exclude', 'generated/**'));
  await writeJson(join(root, 'agent-doc-rules.config.json'), config);

  const errors = await checkRepositorySelfCompliance(root);
  assert.ok(errors.some((error) => error.includes(
    'docs.security.exclude must repeat shared exclusion "generated/**"',
  )));
});

test('both documented gates must transitively run the checker command', async (context) => {
  for (const script of ['test', 'docs:check']) {
    await context.test(script, async (subtest) => {
      const root = await createFixture(subtest);
      const manifest = await readJson(join(root, 'package.json'));

      manifest.scripts[script] = 'echo tools/check-self-compliance.mjs';
      await writeJson(join(root, 'package.json'), manifest);

      const errors = await checkRepositorySelfCompliance(root);
      assert.ok(errors.includes(`package.json ${script} must run tools/check-self-compliance.mjs.`));
    });
  }
});

test('successful gate wiring cannot bypass or swallow the checker', async (context) => {
  const cases = [
    ['test', 'node tools/check-self-compliance.mjs || true'],
    ['docs:check', 'agent-doc-rules-docs check || node tools/check-self-compliance.mjs'],
    ['test', 'node tools/check-self-compliance.mjs; exit 0'],
    ['test', 'node tools/check-self-compliance.mjs | true'],
    ['test', 'node tools/check-self-compliance.mjs & true'],
  ];

  for (const [script, command] of cases) {
    await context.test(command, async (subtest) => {
      const root = await createFixture(subtest);
      const manifest = await readJson(join(root, 'package.json'));

      manifest.scripts[script] = command;
      await writeJson(join(root, 'package.json'), manifest);

      const errors = await checkRepositorySelfCompliance(root);
      assert.ok(errors.includes(`package.json ${script} must run tools/check-self-compliance.mjs.`));
    });
  }
});

test('AGENTS.md accepts the documented Skill Reference heading', async (context) => {
  const root = await createFixture(context);
  const path = join(root, 'AGENTS.md');
  const content = await readFile(path, 'utf8');

  await writeFile(path, content.replace('## Shared Rules', '## Skill Reference'));

  assert.deepEqual(await checkRepositorySelfCompliance(root), []);
});

test('only accepted decisions require live backlinks', async (context) => {
  for (const status of ['Archived', 'Superseded']) {
    await context.test(`${status} may omit backlinks`, async (subtest) => {
      const root = await createFixture(subtest);
      await setDecisionStatusAndRemoveBacklinks(root, status);

      assert.deepEqual(await checkRepositorySelfCompliance(root), []);
    });
  }

  await context.test('Accepted still requires a backlink', async (subtest) => {
    const root = await createFixture(subtest);
    await setDecisionStatusAndRemoveBacklinks(root, 'Accepted');

    const errors = await checkRepositorySelfCompliance(root);
    assert.ok(errors.some((error) => error.includes('is missing required Backlinks content')));
    assert.ok(errors.some((error) => error.includes('must name at least one affected-surface backlink')));
  });
});

test('decision backlinks cannot read outside the repository', async (context) => {
  const root = await createFixture(context);
  const decisionPath = join(root, 'docs/decisions/accepted.md');
  const outsidePath = `${root}-outside.md`;
  const href = relative(dirname(decisionPath), outsidePath).replaceAll('\\', '/');
  const content = await readFile(decisionPath, 'utf8');

  await writeFile(outsidePath, 'accepted.md\n');
  context.after(() => rm(outsidePath, { force: true }));
  await writeFile(decisionPath, content.replace('../../README.md', href));

  const errors = await checkRepositorySelfCompliance(root);
  assert.ok(errors.some((error) => error.includes(
    'backlink target must stay inside the repository',
  )));
});

test('governance decisions must backlink the validator config', async (context) => {
  const root = await createFixture(context);
  const config = await readJson(join(root, 'agent-doc-rules.config.json'));
  const pattern = '^https://example\\.invalid(?:/|$)';
  const entry = governanceEntry('docs.links.skip', pattern);

  entry.decision = 'docs/decisions/accepted.md';
  config.docs.links = { skip: [pattern] };
  config.governance.exceptions.push(entry);
  await writeJson(join(root, 'agent-doc-rules.config.json'), config);

  const errors = await checkRepositorySelfCompliance(root);
  assert.ok(errors.includes(
    'Governance decision docs/decisions/accepted.md must backlink agent-doc-rules.config.json.',
  ));
});

test('required decision sections must contain text for every status', async (context) => {
  const cases = [
    ['Context', 'Fixture context.'],
    ['Decision', 'Fixture decision.'],
    ['Trade-Off', 'Fixture trade-off.'],
    ['Applies To', 'The fixture README.'],
    ['Revisit When', 'The fixture changes.'],
  ];

  for (const status of ['Accepted', 'Archived', 'Superseded']) {
    for (const [heading, body] of cases) {
      await context.test(`${status} ${heading}`, async (subtest) => {
        const root = await createFixture(subtest);
        const path = join(root, 'docs/decisions/accepted.md');
        const content = await readFile(path, 'utf8');
        const changed = content
          .replace('Status: Accepted', `Status: ${status}`)
          .replace(`## ${heading}\n\n${body}`, `## ${heading}\n`);
        await writeFile(path, changed);

        const errors = await checkRepositorySelfCompliance(root);
        assert.ok(
          errors.some((error) => error.includes(`has empty required ${heading} content`)),
          `Expected empty ${heading} error for ${status}:\n${errors.join('\n')}`,
        );
      });
    }
  }
});

async function createFixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'agent-doc-rules-self-compliance-'));
  context.after(() => rm(root, { recursive: true, force: true }));

  const files = {
    'AGENTS.md': `# Fixture - AI Agent Instructions

Start with the [repository README](README.md).

## Shared Rules

[AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)

## Source Of Truth

- [Main skill](packages/agent-doc-rules-skill/skills/agent-doc-rules/SKILL.md)
- [Duplicate skill](packages/agent-doc-rules-skill/skills/docs-duplicate-review/SKILL.md)
- [Skill README](packages/agent-doc-rules-skill/README.md)
- [Development](docs/development.md)
- [Cleanup](docs/project-cleanup.md)
- [Release](docs/release-management.md)

## Verification

Documentation only. Skill layout or install behavior. Runtime, validator, or E2E code.
Release preparation supersedes other checks. If skipped, state the reason and residual risk.
`,
    'README.md': `# Fixture

Fixture repository. See the [skill README](packages/agent-doc-rules-skill/README.md),
[development guide](docs/development.md), and [accepted decision](docs/decisions/accepted.md).

\`\`\`bash
corepack pnpm install
corepack pnpm test
\`\`\`

Run \`corepack pnpm run docs:check\` for documentation.
`,
    'docs/development.md': `# Development

Use \`corepack pnpm exec agent-doc-rules-docs init --print\`.

## Repository Map

Fixture map.

## Maintainer Docs

Fixture docs.
`,
    'packages/docs-validator/README.md': `# Validator

Install \`@fixture/validator@1.0.0\`.

[Config reference](../agent-doc-rules-skill/skills/agent-doc-rules/references/config-reference.md)

Record why a check was skipped and its residual risk.
`,
    'packages/agent-e2e-runner/README.md': `# Runner

Install \`@fixture/runner@1.0.0\`.

## Security Boundary

Dependency lifecycle scripts run. Codex inherits the runner environment. It is not container isolation.

Run \`npx --no-install agent-e2e-runner\`.

- [Scenarios](docs/writing-agent-scenarios.md)
- [Reference](docs/reference.md)
- [Architecture](docs/architecture.md)
- [Report](../agent-e2e-report/docs/report-format.md)
`,
    'packages/agent-e2e-runner/docs/writing-agent-scenarios.md': `# Scenarios

\`\`\`json
{
  "devDependencies": {
    "@fixture/runner": "1.0.0"
  }
}
\`\`\`
`,
    'packages/agent-doc-rules-skill/README.md': `# Skill

Install \`@fixture/skill@1.0.0\` and \`@fixture/validator@1.0.0\` with \`skills@1.5.12\`.
`,
    'packages/agent-doc-rules-skill/docs/adoption.md': `# Adoption

Install \`@fixture/skill@1.0.0\` and \`@fixture/validator@1.0.0\` with \`skills@1.5.12\`.
`,
    'packages/agent-e2e-report/README.md': `# Report

Install \`@fixture/report@1.0.0\`.
`,
    'docs/decisions/README.md': `# Decisions

- [Accepted](accepted.md)
- [Validation exceptions](validation-exceptions.md)
`,
    'docs/decisions/accepted.md': `# Accepted Decision

Status: Accepted
Date: 2026-08-17

## Context

Fixture context.

## Decision

Fixture decision.

## Trade-Off

Fixture trade-off.

## Applies To

The fixture README.

## Backlinks

- [README](../../README.md)

## Revisit When

The fixture changes.
`,
    'docs/decisions/validation-exceptions.md': `# Validation Exceptions

Status: Accepted
Date: 2026-08-17

## Context

Fixture validation context.

## Decision

Govern fixture validation exceptions.

## Trade-Off

Fixture validation trade-off.

## Applies To

The fixture validator config.

## Backlinks

- [Validator config](../../agent-doc-rules.config.json)

## Revisit When

The fixture config changes.
`,
    'package.json': JSON.stringify({
      type: 'module',
      scripts: {
        test: 'corepack pnpm run test:static',
        'test:static': 'corepack pnpm run test:self-compliance',
        'test:self-compliance': 'node tools/check-self-compliance.mjs',
        'docs:self': 'node tools/check-self-compliance.mjs',
        'docs:check': 'agent-doc-rules-docs check && corepack pnpm run docs:self',
      },
    }, null, 2),
    'packages/agent-doc-rules-skill/package.json': packageManifest('@fixture/skill'),
    'packages/docs-validator/package.json': packageManifest('@fixture/validator'),
    'packages/agent-e2e-runner/package.json': packageManifest('@fixture/runner'),
    'packages/agent-e2e-report/package.json': packageManifest('@fixture/report'),
    'agent-doc-rules.config.json': JSON.stringify({
      docs: {
        include: [...defaultInclude],
        exclude: [...defaultExclude],
        duplicateCandidates: { ignorePairs: [] },
      },
      governance: {
        record: 'docs/decisions/validation-exceptions.md',
        exceptions: [],
      },
    }, null, 2),
  };

  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${content.trimEnd()}\n`);
  }

  return root;
}

function packageManifest(name) {
  return JSON.stringify({ name, version: '1.0.0' }, null, 2);
}

function governanceEntry(setting, value) {
  return {
    setting,
    value,
    reason: 'This fixture exception exercises repository governance.',
    decision: 'docs/decisions/validation-exceptions.md',
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function setDecisionStatusAndRemoveBacklinks(root, status) {
  const path = join(root, 'docs/decisions/accepted.md');
  const content = await readFile(path, 'utf8');
  const withoutBacklinks = content
    .replace('Status: Accepted', `Status: ${status}`)
    .replace(/\n## Backlinks\n[\s\S]*?(?=\n## Revisit When)/, '');
  await writeFile(path, withoutBacklinks);
}
