import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '@buresmi7/agent-e2e-runner';

const e2eRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(e2eRoot, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const runner = join(e2eRoot, 'run-scenario.mjs');
const scenarioDirs = [];

for (const entry of await readdir(e2eRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const scenarioDir = join(e2eRoot, entry.name);
  let scenario;

  try {
    await access(join(scenarioDir, 'project'));
    scenario = JSON.parse(await readFile(join(scenarioDir, 'scenario.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      continue;
    }

    throw error;
  }

  if (typeof scenario.command !== 'string') {
    continue;
  }

  scenarioDirs.push(scenarioDir);
}

if (scenarioDirs.length === 0) {
  console.log('No command E2E scenarios found.');
  process.exit(0);
}

for (const scenarioDir of scenarioDirs.sort()) {
  const projectDir = join(scenarioDir, 'project');
  const { stdout, stderr } = await runCommand(process.execPath, [runner], '', {
    cwd: projectDir,
    env: {
      ...process.env,
      SCENARIO_DIR: projectDir,
    },
  });

  process.stdout.write(stdout);
  process.stderr.write(stderr);
}
