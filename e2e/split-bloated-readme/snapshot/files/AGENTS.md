# Agent Instructions

## Shared Rules

- Follow `.agents/skills/agent-doc-rules/references/agents-md.md` for general
  `AGENTS.md` maintenance rules.
- Inspect `README.md` and `docs/` before editing repository documentation.
- Keep repository documentation in English.

## Project Rules

- Do not paste webhook payloads into issues or generated docs. Payloads can
  contain customer email addresses and invoice IDs.
- Do not invent cloud provider names or environment-specific infrastructure.
- Keep architecture detail in `docs/architecture.md`, operations detail in
  `docs/operations.md`, and queue contract detail in
  `docs/contracts/billing-events.md`.

## Verification

- Run `npm test` before publishing code or documentation changes when possible.
- This repository does not declare a `docs:check` script in `package.json`.
- If a check is skipped, record the reason and the residual risk.
