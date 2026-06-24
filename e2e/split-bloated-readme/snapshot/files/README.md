# Orchard Webhook Proxy

Orchard Webhook Proxy receives webhook events from Orchard, validates each
signature, and forwards approved events to the internal billing queue.

## Quick Start

Run the test suite from the repository root:

```sh
npm test
```

## Canonical Docs

Use these files as the source of truth for their topics. Keep this README as the
small entry point.

| Document | Content |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Agent routing and local rules |
| [docs/architecture.md](docs/architecture.md) | Request flow and retry boundary |
| [docs/contracts/billing-events.md](docs/contracts/billing-events.md) | Forwarded event fields |
| [docs/operations.md](docs/operations.md) | Replay, release, and troubleshooting |
