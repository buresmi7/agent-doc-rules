# Orchard Webhook Proxy - AI Agent Instructions

Orchard Webhook Proxy validates Orchard webhook signatures and forwards accepted
events to the internal billing queue.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [README rules](.agents/skills/agent-doc-rules/references/readme-rules.md)
- [Documentation architecture](.agents/skills/agent-doc-rules/references/documentation-architecture.md)

## Local Rules

- Inspect [README.md](README.md) and the relevant files under [docs/](docs/)
  before editing documentation.
- Keep persisted documentation in English.
- Do not invent cloud provider names or deployment hosts.
- Do not paste raw webhook payloads into issues, generated docs, examples, or
  committed fixtures. Payloads can contain customer email addresses, invoice
  IDs, and account IDs.

## Source Of Truth

- [README.md](README.md) is the human entry point and canonical docs index.
- [docs/contracts/billing-events.md](docs/contracts/billing-events.md) owns the
  billing queue event contract.
- [docs/operations.md](docs/operations.md) owns release and troubleshooting
  notes.

## Verification

- Run `npm test` after code or contract changes.
- This repository does not expose `docs:check`.
- If a relevant check cannot run, state the blocker and what remains
  unverified.
