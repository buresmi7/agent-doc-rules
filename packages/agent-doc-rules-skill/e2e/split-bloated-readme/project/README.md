# Orchard Webhook Proxy

Orchard Webhook Proxy receives webhook events from Orchard, validates the
signature, and forwards approved events to the internal billing queue.

## Quick start

Run the tests with `npm test`.

## Architecture, operations, agent rules, and other notes

The service has one HTTP entry point, `POST /webhooks/orchard`. The handler
checks the `x-orchard-signature` header before accepting a request. Events that
fail validation are rejected without writing to the queue.

The billing queue contract lives in `docs/contracts/billing-events.md`.

When a delivery fails because the queue is unavailable, the service writes the
event to local retry storage. Operators replay retry storage with
`npm run replay`.

Agents must not paste webhook payloads into issues or generated docs. Payloads
can contain customer email addresses and invoice IDs.

Agents must inspect the README and docs before editing. Agents must not invent
cloud provider names. Agents must keep documentation in English.

Release steps:

1. Run `npm test`.
2. Run `npm run replay -- --dry-run`.
3. Check that `docs/contracts/billing-events.md` still matches the queue
   schema.
4. Update the changelog.

Troubleshooting:

- If signatures fail locally, check that the fixture header matches the fixture
  body.
- If replay fails, run it again with `--dry-run` before changing code.
- If queue writes fail, do not document the raw payload.

This README intentionally holds too much information. It should be split into a
small entry point plus durable docs and short agent instructions.
