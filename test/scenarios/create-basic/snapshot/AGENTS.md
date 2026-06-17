# Acme Status Bot - AI Agent Instructions

Acme Status Bot is a small internal service that reads public status feeds and
creates a daily Markdown summary for operators. Keep this file as a short
navigation layer for agents.

## Shared Rules

- [AGENTS.md rules](agent-rules/shared/rules/agents-md.md)
- [Documentation architecture](agent-rules/shared/rules/documentation-architecture.md)

## Local Rules

- Persisted project artifacts are written in English.
- The first implementation phase is read-only.
- Do not store API tokens, status feed credentials, or customer identifiers in
  the repository.

## Source Of Truth

- Product behavior: [README.md](README.md)
- Operational procedures: [docs/runbooks/](docs/runbooks/)
- Architecture decisions: [docs/decisions/](docs/decisions/)
- Resolve conflicts by using the canonical document for that topic.

## Verification

- Run `npm test` before publishing documentation or template changes.
- If tests cannot run, document the reason and remaining risk.
- After documentation link changes, verify local relative links in changed docs.
