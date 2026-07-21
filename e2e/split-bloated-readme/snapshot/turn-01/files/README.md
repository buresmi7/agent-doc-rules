# Orchard Webhook Proxy

Orchard Webhook Proxy receives webhook events from Orchard, validates the
signature, and forwards approved events to the internal billing queue.

## Canonical Docs

| Document | Content |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Local instructions for AI agents |
| [docs/contracts/billing-events.md](docs/contracts/billing-events.md) | Billing queue event contract |
| [docs/operations.md](docs/operations.md) | Release and troubleshooting notes |

## Quick Start

Run the tests:

```sh
npm test
```

## Project Notes

The service exposes one HTTP entry point: `POST /webhooks/orchard`. The handler
checks the `x-orchard-signature` header before accepting a request. Events that
fail validation are rejected without writing to the queue.

The billing queue receives only events that match the
[billing events contract](docs/contracts/billing-events.md). Operational checks
and repair notes live in [docs/operations.md](docs/operations.md).
