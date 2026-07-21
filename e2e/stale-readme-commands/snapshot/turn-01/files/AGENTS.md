# Metric Cards - AI Agent Instructions

Metric Cards renders Markdown snippets for dashboard metric definitions.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [README rules](.agents/skills/agent-doc-rules/references/readme-rules.md)

## Local Rules

- Keep project documentation focused on the commands and files visible in this
  repository.
- Do not add setup, lint, deploy, hosting, or release instructions unless the
  supporting command or canonical doc exists.

## Source Of Truth

- `README.md` is the human entry point and verified command index.
- `package.json` is the source of truth for npm scripts.

## Verification

- Run `npm test` and `npm run docs:check` after documentation changes.
- If a check cannot run, report why and state the remaining risk.
