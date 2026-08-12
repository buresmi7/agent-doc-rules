import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '@buresmi7/agent-e2e-runner';

const e2eRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(e2eRoot, '../../..');
const projectFixtureDir = process.env.SCENARIO_DIR
  ? resolve(process.env.SCENARIO_DIR)
  : process.cwd();
const scenarioDir = dirname(projectFixtureDir);
const args = [
  'agent',
  '--config',
  join(e2eRoot, 'agent-e2e.config.mjs'),
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

args.push(...process.argv.slice(2));

process.exitCode = await main(args, { cwd: repoRoot });
