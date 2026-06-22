import { spawnSync } from 'node:child_process';

const allowed = new Map([
  ['markdownlint-cli2', 'moderate dev-only Markdown lint dependency advisory'],
  ['markdown-it', 'transitive dev-only Markdown lint dependency advisory'],
  ['js-yaml', 'transitive dev-only Markdown lint dependency advisory'],
]);

const result = spawnSync('corepack', ['pnpm', 'audit', '--json'], {
  encoding: 'utf8',
});

let report;

try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('Could not parse pnpm audit JSON output.');
  console.error(result.stdout || result.stderr);
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const unexpected = [];

for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
  if (!allowed.has(name)) {
    unexpected.push(`${name}: ${vulnerability.severity}`);
  }
}

if (unexpected.length > 0) {
  console.error('Unexpected pnpm audit findings:');
  for (const finding of unexpected) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

if (Object.keys(vulnerabilities).length > 0) {
  console.log('pnpm audit contains only accepted dev-tooling advisories:');
  for (const name of Object.keys(vulnerabilities)) {
    console.log(`- ${name}: ${allowed.get(name)}`);
  }
} else {
  console.log('pnpm audit passed with no vulnerabilities.');
}
