import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'README.md',
  'AGENTS.md',
  'CHANGELOG.md',
  'LICENSE',
  'rules/agents-md.md',
  'rules/documentation-architecture.md',
  'templates/AGENTS.project.md',
  'templates/AGENTS.overlay.md',
];

const forbiddenPatterns = [
  { pattern: /\bmeta-work\b/i, reason: 'shared rules must not mention the source workspace' },
  { pattern: /\btm (new|adopt|context|rehydrate|checklist|comment|env|close)\b/i, reason: 'shared rules must not mention task-manager commands' },
  { pattern: /\btask-manager CLI\b/i, reason: 'shared rules must not mention the task-manager CLI' },
  { pattern: /worktrees\//i, reason: 'shared rules must not include task worktree conventions' },
  { pattern: /registry\.json/i, reason: 'shared rules must not include task-manager registry state' },
  { pattern: /AWS SSO/i, reason: 'shared rules must not include project-specific cloud workflow' },
  { pattern: /\/home\/ai-dev/i, reason: 'shared rules must not include local machine paths' },
];

const currentDocsForbiddenPatterns = [
  { pattern: /notion/i, reason: 'current docs should not recommend Notion-specific workflows' },
];

const requiredReadmeSnippets = [
  '## Why This Exists',
  '## Install In A Project',
  '## Update A Project Snapshot',
  '## Publishing Model',
  '## Repository Health Checklist',
];

function collectFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (entry === '.git' || entry === 'node_modules') {
        return [];
      }

      return collectFiles(path);
    }

    return [path];
  });
}

const errors = [];

for (const file of requiredFiles) {
  try {
    statSync(join(root, file));
  } catch {
    errors.push(`Missing required file: ${file}`);
  }
}

const files = collectFiles(root).filter((file) => {
  return (
    file.endsWith('.md') ||
    file.endsWith('.json') ||
    file.endsWith('.jsonc')
  );
});

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);

  for (const { pattern, reason } of forbiddenPatterns) {
    if (pattern.test(text)) {
      errors.push(`${rel}: ${reason}`);
    }
  }
}

for (const file of files.filter((file) => !file.endsWith('CHANGELOG.md'))) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(root, file);

  for (const { pattern, reason } of currentDocsForbiddenPatterns) {
    if (pattern.test(text)) {
      errors.push(`${rel}: ${reason}`);
    }
  }
}

const readme = readFileSync(join(root, 'README.md'), 'utf8');

for (const snippet of requiredReadmeSnippets) {
  if (!readme.includes(snippet)) {
    errors.push(`README.md: missing required section ${snippet}`);
  }
}

if (/Optional Codex Skills/i.test(readme) || /maintainer skill recommendations/i.test(readme)) {
  errors.push('README.md: skill recommendation section must not be reintroduced');
}

if (errors.length > 0) {
  console.error('Content check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Content check passed for ${files.length} files.`);
