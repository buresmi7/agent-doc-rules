const aiDependencyPatterns = [
  /^openai$/i,
  /^@openai\//i,
  /^@anthropic-ai\//i,
  /^@google\/(?:generative-ai|genai)$/i,
  /^(?:cohere-ai|mistralai|ollama)$/i,
];

const runtimePatterns = [
  {
    label: 'AI SDK import',
    pattern: /["'](?:openai|@openai\/[^"']+|@anthropic-ai\/[^"']+|@google\/(?:generative-ai|genai)|cohere-ai|mistralai|ollama)["']/gi,
  },
  {
    label: 'secondary AI CLI invocation',
    pattern: /\b(?:aider|claude|codex|gemini|ollama)\s+(?:--model|--print|--prompt|auth|chat|exec|login|run)\b/gi,
  },
  {
    label: 'secondary AI CLI process',
    pattern: /\b(?:spawn|spawnSync|execFile|execFileSync|execa)\s*\(\s*["'](?:aider|claude|codex|gemini|ollama)["']/gi,
  },
  {
    label: 'AI executable literal',
    pattern: /["'](?:aider|claude|codex|gemini|ollama)["']/gi,
  },
  {
    label: 'retired AI runtime identifier',
    pattern: /\b(?:buildCodexInvocation|codexBin|model_reasoning_effort|reasoningEffort|resolveCodexExecutable|runCodex(?:Classifier|StyleReviewer)?)\b/g,
    retiredMigration: true,
  },
  {
    label: 'AI runtime environment configuration',
    pattern: /\b(?:ANTHROPIC|CODEX|COHERE|GEMINI|GOOGLE_GENERATIVE_AI|MISTRAL|OPENAI)_(?:API_KEY|AUTH|BIN|MODEL|REASONING_EFFORT)\b/g,
  },
  {
    label: 'AI provider endpoint',
    pattern: /\b(?:api\.anthropic\.com|api\.cohere\.ai|api\.mistral\.ai|api\.openai\.com|generativelanguage\.googleapis\.com)\b/gi,
  },
  {
    label: 'retired duplicate-checker runtime',
    pattern: /agent-doc-rules-docs-duplicates/gi,
    retiredMigration: true,
  },
  {
    label: 'retired project-local AI package',
    pattern: /@openai\/codex/gi,
    retiredMigration: true,
  },
];

export function findConsumerAiDependencyViolations(manifest) {
  const violations = [];

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (aiDependencyPatterns.some((pattern) => pattern.test(name))) {
        violations.push(`${section}.${name}`);
      }
    }
  }

  return violations;
}

export function findConsumerRuntimeDependencyViolations(manifest, allowedDependencies = []) {
  const allowed = new Set(allowedDependencies);
  const violations = [];

  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (section !== 'dependencies' || !allowed.has(name)) {
        violations.push(`${section}.${name}`);
      }
    }
  }

  return violations;
}

export function findConsumerAiTextViolations(content, { allowRetiredMigration = false } = {}) {
  const violations = [];

  for (const definition of runtimePatterns) {
    definition.pattern.lastIndex = 0;

    for (const match of content.matchAll(definition.pattern)) {
      if (
        definition.retiredMigration
        && allowRetiredMigration
        && isRemovalContext(content, match.index ?? 0)
      ) {
        continue;
      }

      violations.push({
        label: definition.label,
        match: match[0],
      });
    }
  }

  return violations;
}

function isRemovalContext(content, index) {
  const context = content.slice(Math.max(0, index - 180), index + 180);
  return /\b(?:migration|remove|retired|unsupported)\b/i.test(context);
}
