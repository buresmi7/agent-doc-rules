export const defaultInclude = [
  '*.md',
  'docs/**/*.md',
  '**/AGENTS.md',
  '.agents/skills/**/*.md',
  'packages/**/*.md',
  'rules/**/*.md',
  '.codex/**/*.md',
];

export const defaultExclude = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'coverage/**',
  '.tmp/**',
  'repos/**',
  'worktrees/**',
];

export const defaultConfigFile = 'agent-doc-rules.config.json';
