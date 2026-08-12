# Tidy Guides - AI Agent Instructions

Tidy Guides stores short Markdown guides for internal developer tools.

## Shared Rules

- AGENTS.md rules: `.agents/skills/agent-doc-rules/references/agents-rules.md`
- README rules: `.agents/skills/agent-doc-rules/references/readme-rules.md`
- Documentation architecture: `.agents/skills/agent-doc-rules/references/documentation-architecture.md`

## Local Rules

- Keep persisted documentation in English.
- Do not include private customer names or internal ticket URLs in examples.

## Source Of Truth

- `README.md` is the human entry point and docs index.
- `docs/style.md` is canonical for guide formatting.

## Verification

- Run `npm run docs:check` before finishing documentation changes.
- If that command is unavailable, say what remained unchecked.
