# Docs Validation Routing Fixture - AI Agent Instructions

This repository keeps short operational notes for internal reporting scripts.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-md.md)

## Local Rules

- Keep repository documentation concise and operational.
- Preserve facts from `README.md` and `package.json`; do not invent workflows.

## Source Of Truth

- `README.md` describes the repository purpose and common commands.
- `package.json` defines available npm scripts.

## Verification

- Run `npm run docs:check` for documentation changes.
- Run `npm test` for test coverage.
- If a check cannot run, state why and note the remaining risk.
