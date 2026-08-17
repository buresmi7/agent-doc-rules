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
  '.agent-e2e-output/**',
  'repos/**',
  'worktrees/**',
];

export const defaultConfigFile = 'agent-doc-rules.config.json';

export const duplicateCandidateDefaults = {
  includeReferences: false,
  includeSameFile: false,
  minSimilarity: 0.72,
  minWords: 6,
  minChars: 40,
  maxCandidates: 50,
  ignorePairs: [],
};
