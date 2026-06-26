import { access, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './e2e-runner/process.mjs';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const e2eRoot = join(repoRoot, 'e2e');
const runner = join(repoRoot, 'tools/run-command-e2e-scenario.mjs');
const scenarioDirs = [];

for (const entry of await readdir(e2eRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const scenarioDir = join(e2eRoot, entry.name);

  try {
    await access(join(scenarioDir, 'project'));
    await access(join(scenarioDir, 'scenario.json'));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      continue;
    }

    throw error;
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
