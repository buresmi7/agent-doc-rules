# Acme Status Bot - AI Agent Instructions

Acme Status Bot is a small internal service that reads public status feeds and
creates a daily Markdown summary for operators.

## Shared Rules

- AGENTS.md rules: `.agents/skills/agent-doc-rules/references/agents-md.md`
- README rules: `.agents/skills/agent-doc-rules/references/readme.md`
- Documentation architecture: `.agents/skills/agent-doc-rules/references/documentation-architecture.md`

## Local Rules

- Persisted project artifacts are written in English.
- The first implementation phase is read-only.
- Do not store API tokens, status feed credentials, or customer identifiers in
  the repository.

## Source Of Truth

- Product behavior lives in `README.md`.
- Operational procedures live in `docs/runbooks/`.
- Architecture decisions live in `docs/decisions/`.
- When docs conflict, prefer the source listed for that area and update links
  instead of copying canonical detail here.

## Verification

- Run `npm test` before publishing documentation or template changes.
- If tests cannot run, document the reason and remaining risk.
