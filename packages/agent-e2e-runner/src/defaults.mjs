export const defaultJudgePromptTemplate = `# Judge Agent E2E Scenario

Judge a real Codex session against the scenario criteria. The agent received
each user turn in order and edited the temporary fixture project with its normal
tools. Judge both the conversation and the resulting project state.

Return JSON only with this shape:

\`\`\`json
{
  "pass": true,
  "score": 0.0,
  "failedCriteria": [
    {
      "id": "criterion id",
      "reason": "why it failed"
    }
  ],
  "requiredFixes": ["concrete fix"],
  "notes": "short explanation"
}
\`\`\`

Scoring:

- \`pass\` must be true only when all critical criteria pass.
- \`score\` is from 0.0 to 1.0.
- Each criteria block applies to the response, tool activity, and project state
  immediately after its matching turn. A later correction does not erase an
  earlier failure unless the criterion explicitly says otherwise.
- Fail if the output omits a critical requirement from the criteria.
- Fail if the output contradicts the fixture project context.
- Fail if the output invents project facts, tools, services, commands, or
  workflows not supported by the project context.
- Fail if the agent changed files outside the expected scenario surface.

Scenario criteria:

\`\`\`text
{{criteria}}
\`\`\`

Original project context before the agent session:

\`\`\`text
{{originalProjectFiles}}
\`\`\`

Final project context after the agent session:

\`\`\`text
{{projectFiles}}
\`\`\`

Final file changes:

\`\`\`text
{{changes}}
\`\`\`

Conversation, tool activity, and per-turn changes:

\`\`\`text
{{transcript}}
\`\`\`
`;
