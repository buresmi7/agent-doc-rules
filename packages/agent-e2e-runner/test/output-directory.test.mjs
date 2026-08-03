import assert from 'node:assert/strict';
import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  createScenarioOutputDirectory,
  defaultOutputDirectoryName,
  normalizeOutputPrefix,
  removeScenarioOutputDirectory,
} from '../src/output-directory.mjs';

test('createScenarioOutputDirectory keeps isolated runs beside the scenario', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-output-'));
  const scenarioDir = join(root, 'e2e/example');
  const first = await createScenarioOutputDirectory({
    scenarioDir,
    projectFixtureDir: join(scenarioDir, 'project'),
    prefix: 'agent-e2e-example',
  });
  const second = await createScenarioOutputDirectory({
    scenarioDir,
    projectFixtureDir: join(scenarioDir, 'project'),
    prefix: 'agent-e2e-example',
  });
  const expectedRoot = join(scenarioDir, defaultOutputDirectoryName);

  assert.equal(first.outputRoot, expectedRoot);
  assert.equal(dirname(first.outputDir), expectedRoot);
  assert.equal(dirname(second.outputDir), expectedRoot);
  assert.notEqual(first.outputDir, second.outputDir);
  assert.match(first.outputDir, /agent-e2e-example-/);
  assert.equal(
    await readFile(join(expectedRoot, '.gitignore'), 'utf8'),
    '# Generated agent-e2e-runner output\n*\n',
  );
  assert.equal(
    await readFile(join(first.outputDir, 'pnpm-workspace.yaml'), 'utf8'),
    'packages:\n  - project\n',
  );
  assert.equal(
    await readFile(join(first.outputDir, '.npmrc'), 'utf8'),
    'workspaces=false\n',
  );
  assert.deepEqual(
    JSON.parse(await readFile(join(first.outputDir, 'package.json'), 'utf8')),
    {
      name: 'agent-e2e-run',
      private: true,
    },
  );

  await removeScenarioOutputDirectory(first.outputDir);
  await assert.rejects(() => access(first.outputDir), /ENOENT/);
  await access(second.outputDir);
});

test('createScenarioOutputDirectory accepts an explicit output root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-output-custom-'));
  const scenarioDir = join(root, 'scenario');
  const outputRoot = join(root, 'artifacts');
  const result = await createScenarioOutputDirectory({
    scenarioDir,
    outputRoot,
    prefix: 'custom',
  });

  assert.equal(result.outputRoot, outputRoot);
  assert.equal(dirname(result.outputDir), outputRoot);
  await assert.rejects(() => access(join(outputRoot, '.gitignore')), /ENOENT/);
});

test('createScenarioOutputDirectory stays outside a fixture that contains the scenario', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-output-overlap-'));
  const scenarioDir = join(root, 'e2e/example');
  const result = await createScenarioOutputDirectory({
    scenarioDir,
    projectFixtureDir: scenarioDir,
    prefix: 'overlap',
  });

  assert.equal(
    result.outputRoot,
    join(root, 'e2e/.agent-e2e-output/example-example'),
  );
});

test('createScenarioOutputDirectory rejects a custom root inside the fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-output-unsafe-'));
  const projectFixtureDir = join(root, 'project');

  await assert.rejects(
    () => createScenarioOutputDirectory({
      scenarioDir: root,
      projectFixtureDir,
      outputRoot: join(projectFixtureDir, '..output'),
    }),
    /output root must be outside the fixture project/,
  );
  await assert.rejects(
    () => createScenarioOutputDirectory({
      scenarioDir: root,
      outputRoot: '',
    }),
    /outputRoot must be a non-empty path/,
  );
});

test('normalizeOutputPrefix removes path separators and unsafe characters', () => {
  assert.equal(
    normalizeOutputPrefix('../context placement / review'),
    '..-context-placement-review',
  );
  assert.equal(normalizeOutputPrefix('   '), 'agent-e2e');
});
