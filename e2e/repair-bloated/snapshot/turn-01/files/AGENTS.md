# Ledger Notes Agent Instructions

Ledger Notes stores Markdown notes for personal bookkeeping experiments. This
repository is documentation-only for now.

## Shared Rules

- Follow the shared [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md).

## Local Rules

- Write documentation and commit messages in English.
- Do not commit bank data, real account numbers, exported statements, tokens, or
  screenshots containing financial details.

## Source Of Truth

- `README.md` describes the current project scope and constraints.
- `docs/decisions/` stores accepted decisions when that directory exists.

## Verification

- Run Markdown checks before release when a checker is available.
- No package verification script is currently defined in `package.json`.
- If verification is skipped, say why and note the remaining risk.
