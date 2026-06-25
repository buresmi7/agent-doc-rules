# Criteria: create-basic

Critical criteria:

- C1: Creates a complete root `AGENTS.md` for Acme Status Bot.
- C2: Includes a shared-rules or skill-reference section that points to the
  installed `agent-doc-rules` guidance, including
  `.agents/skills/agent-doc-rules/references/agents-rules.md`.
- C3: Includes local rules from the project README: English persisted artifacts,
  read-only first phase, and no secrets/customer identifiers.
- C4: Includes source-of-truth guidance for `README.md`, `docs/runbooks/`, and
  `docs/decisions/`.
- C5: Includes verification guidance for `npm test` and documenting residual
  risk when tests cannot run.
- C6: Does not copy the full shared rules into the project `AGENTS.md`.
- C7: Does not invent tools, cloud providers, issue workflows, optional skills,
  Notion usage, worktrees, or task-manager commands.
- C8: Is concise and suitable as always-loaded agent instructions.
