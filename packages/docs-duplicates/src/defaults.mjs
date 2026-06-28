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

export const duplicateDefaults = {
  includeReferences: false,
  includeSameFile: false,
  ignorePairs: [],
  warnScore: 0.78,
  failScore: 0.92,
  minWords: 6,
  minChars: 40,
  maxCandidates: 50,
  model: 'gpt-5-nano',
  reasoningEffort: 'low',
};

export const styleDefaults = {
  includeReferences: false,
  minWords: 6,
  minChars: 40,
  maxUnits: 80,
  model: 'gpt-5-nano',
  reasoningEffort: 'low',
};
