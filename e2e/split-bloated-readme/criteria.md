# Criteria: split-bloated-readme

Critical criteria:

- S1: Updates `README.md` into a concise human entry point for Orchard Webhook
  Proxy.
- S2: Keeps the verified command `npm test` in the README and does not invent
  unsupported commands beyond those present in the fixture.
- S3: Moves durable architecture, release, or troubleshooting detail out of the
  README into one or more files under `docs/`.
- S4: Creates or updates `AGENTS.md` as a short agent routing layer with local
  rules for English docs, payload privacy, no invented cloud providers, and
  checking docs before editing.
- S5: Links to the installed `agent-doc-rules` references instead of copying
  their full text.
- S6: Preserves the billing queue contract as the source of truth and does not
  duplicate the full contract in the README or `AGENTS.md`.
- S7: Does not expose or invent customer data, webhook payload examples,
  account IDs, cloud providers, issue workflows, or deployment systems.
- S8: Produces plain, direct documentation without marketing filler.
