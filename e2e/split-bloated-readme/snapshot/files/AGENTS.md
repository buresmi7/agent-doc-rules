# Orchard Webhook Proxy - AI Agent Instructions

Orchard Webhook Proxy validates Orchard webhooks and forwards approved events to
the internal billing queue.

## Shared Rules

- [AGENTS.md rules][agents-rules]
- [README rules][readme-rules]
- [Documentation architecture][doc-arch]

## Source Of Truth

- Inspect [README.md](README.md) and the relevant docs before editing.
- Use [docs/architecture.md](docs/architecture.md) for request flow and retry
  storage behavior.
- Use [docs/contracts/billing-events.md](docs/contracts/billing-events.md) for
  forwarded billing event fields.
- Use [docs/operations.md](docs/operations.md) for replay, release, and
  troubleshooting procedures.

## Local Rules

- Keep persisted documentation in English.
- Do not invent cloud provider names.
- Do not paste webhook payloads into issues or generated docs. Payloads can
  contain customer email addresses and invoice IDs.

## Verification

- Run `npm test` before finishing changes that can affect runtime behavior.
- For release work, follow the checks in [docs/operations.md](docs/operations.md).
- If a check cannot run, state the command, reason, and remaining risk.

[agents-rules]: .agents/skills/agent-doc-rules/references/agents-md.md
[readme-rules]: .agents/skills/agent-doc-rules/references/readme.md
[doc-arch]: .agents/skills/agent-doc-rules/references/documentation-architecture.md
