# Operations

Use this page for release checks and troubleshooting notes for Orchard Webhook
Proxy.

## Release Checks

1. Run the test suite:

   ```sh
   npm test
   ```

2. Check that [docs/contracts/billing-events.md](contracts/billing-events.md)
   still matches the billing queue schema.

The package manifest does not expose a replay script or changelog file in this
checkout. Do not document replay or changelog steps as required release actions
until the repository contains evidence for them.

## Troubleshooting

- If signatures fail locally, check that the fixture header matches the fixture
  body.
- If queue writes fail, do not document the raw payload. Raw webhook payloads can
  contain customer email addresses, invoice IDs, and account IDs.
