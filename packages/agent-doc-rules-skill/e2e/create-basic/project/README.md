# Acme Status Bot

Acme Status Bot is a small internal service that reads public status feeds and
creates a daily Markdown summary for operators.

## Source Of Truth

- Product behavior lives in `README.md`.
- Operational procedures live in `docs/runbooks/`.
- Architecture decisions live in `docs/decisions/`.

## Local Rules

- Persisted project artifacts are written in English.
- The first implementation phase is read-only.
- Do not store API tokens, status feed credentials, or customer identifiers in
  the repository.

## Verification

- Run `npm test` before publishing documentation or template changes.
- If tests cannot run, document the reason and remaining risk.
