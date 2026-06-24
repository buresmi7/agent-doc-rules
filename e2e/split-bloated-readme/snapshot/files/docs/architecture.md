# Architecture

Orchard Webhook Proxy has one HTTP entry point: `POST /webhooks/orchard`.

The handler checks the `x-orchard-signature` header before accepting a request.
Events that fail validation are rejected without writing to the billing queue.

Approved events are forwarded to the internal billing queue. The queue event
shape is defined in `docs/contracts/billing-events.md`.

When the queue is unavailable, the service writes the event to local retry
storage so operators can replay it later.
