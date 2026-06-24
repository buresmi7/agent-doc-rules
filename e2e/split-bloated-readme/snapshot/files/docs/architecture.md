# Architecture

The service has one HTTP entry point:

```text
POST /webhooks/orchard
```

The handler checks the `x-orchard-signature` header before accepting a request.
Events that fail validation are rejected without writing to the internal billing
queue.

Approved events are forwarded to the internal billing queue. The forwarded event
shape is defined in [Billing Events Contract](contracts/billing-events.md).

When delivery fails because the queue is unavailable, the service writes the
event to local retry storage. Operators replay retry storage with
`npm run replay`; see [Operations](operations.md).
