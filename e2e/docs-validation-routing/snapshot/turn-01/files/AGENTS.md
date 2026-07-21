# Docs Validation Routing Fixture - AI Agent Instructions

This private Node fixture keeps short operational notes for internal reporting
scripts. Keep repository instructions concise and grounded in `README.md` and
`package.json`.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)

## Local Rules

- Do not add unsupported setup, runtime, deployment, or reporting workflows.
- Keep detailed procedures out of this file; link to the canonical project doc
  or skill instead.

## Source Of Truth

- [README.md](README.md) describes the project purpose and supported commands.
- [package.json](package.json) defines the available npm scripts.

## Verification

- Run `npm test` for the Node test suite.
- Run `npm run docs:check` for Markdown, link, and duplicate-doc validation.
- If a check cannot run, state why and note the remaining risk.
