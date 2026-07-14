# Orchard Webhook Proxy

Orchard Webhook Proxy receives webhook events from Orchard, validates the
signature, and forwards approved events to the internal billing queue.

## Quick Start

Run the test suite:

```bash
npm test
```

## Canonical Docs

| Document | Content |
| --- | --- |
| `AGENTS.md` | Agent rules, safety boundaries, and verification guidance |
| `docs/architecture.md` | HTTP entry point, validation, queue forwarding, and retry storage |
| `docs/operations.md` | Release steps and troubleshooting notes |
| `docs/contracts/billing-events.md` | Billing queue event contract |

When docs conflict, use the most specific document as the source of truth.
