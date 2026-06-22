# Ledger Notes - AI Agent Instructions

Ledger Notes stores Markdown notes for personal bookkeeping experiments. This
repository is documentation-only for now.

## Shared Rules

- AGENTS.md rules: `.agents/skills/agent-doc-rules/references/agents-md.md`
- README rules: `.agents/skills/agent-doc-rules/references/readme.md`
- Documentation architecture: `.agents/skills/agent-doc-rules/references/documentation-architecture.md`

## Local Rules

- Write documentation and commit messages in English.
- Treat the repository as documentation-only unless the project scope changes.
- Never commit secrets, bank data, real account numbers, exported statements,
  tokens, or screenshots containing financial details.

## Source Of Truth

- `README.md` describes the current project scope.
- `docs/decisions/` stores accepted decisions.
- Use the README for scope and accepted decisions for the topics they cover.

## Verification

- Run the project's Markdown checks before release; no specific command is
  documented.
- For documentation link changes, follow the shared documentation architecture
  validation guidance.
