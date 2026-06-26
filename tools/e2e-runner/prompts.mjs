export const generateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    files: {
      type: 'array',
      minItems: 0,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['files', 'notes'],
};

export const judgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    failedCriteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['id', 'reason'],
      },
    },
    requiredFixes: {
      type: 'array',
      items: { type: 'string' },
    },
    notes: { type: 'string' },
  },
  required: ['pass', 'score', 'failedCriteria', 'requiredFixes', 'notes'],
};

export function buildGeneratePrompt({ scenarioPrompt, projectFiles, skillContext }) {
  const optionalSkillContext = skillContext
    ? `\n# Skill Context For Non-Skill Runner\n\n${skillContext}\n`
    : '';

  return `# Scenario Prompt

Use $agent-doc-rules for this task.

${scenarioPrompt.trim()}

# Harness Instructions

Return JSON only with this shape:

\`\`\`json
{
  "files": [
    {
      "path": "relative/path.md",
      "content": "complete file content"
    }
  ],
  "notes": "short implementation note"
}
\`\`\`

Rules:

- Include only files you create or change.
- If no file changes are needed, return an empty \`files\` array.
- Use repository-relative file paths.
- Do not use absolute paths or parent-directory traversal.
- Wrap Markdown prose and bullets so lines stay under 100 characters.
- Format Markdown tables with spaces around each pipe separator.
- The target project has installed \`agent-doc-rules\` at
  \`.agents/skills/agent-doc-rules/\`.
- Preserve facts from the project files. Do not invent repository details.
${optionalSkillContext}
Project files:

\`\`\`text
${projectFiles}
\`\`\`
`;
}

export function render(template, values) {
  return Object.entries(values).reduce((output, [key, value]) => {
    return output.replaceAll(`{{${key}}}`, value);
  }, template);
}
