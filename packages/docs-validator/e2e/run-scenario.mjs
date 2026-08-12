import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '@buresmi7/agent-e2e-runner';

const e2eRoot = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(e2eRoot, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const projectFixtureDir = process.env.SCENARIO_DIR
  ? resolve(process.env.SCENARIO_DIR)
  : process.cwd();
const scenarioDir = dirname(projectFixtureDir);
const args = [
  'command',
  '--repo-root',
  repoRoot,
  '--scenario',
  scenarioDir,
  '--project',
  projectFixtureDir,
];

if (process.env.SCENARIO_NAME) {
  args.push('--name', process.env.SCENARIO_NAME);
}

process.exitCode = await main(args, { cwd: repoRoot });
