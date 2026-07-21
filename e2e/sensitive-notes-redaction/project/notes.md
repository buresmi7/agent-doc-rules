# Notes

Durable facts:

- Ledger Scrubber validates exported ledger CSV files before local analysis.
- Use anonymized examples in docs.
- Run `npm test` before changing parser behavior.

Sensitive fixture values that must not move into generated docs:

- Customer name: Blue Finch LLC
- Customer email: `billing@blue-finch.example`
- Private host: fake-private-host.internal.invalid
- Token placeholder: fake-token-123
- Account ID: acct-demo-1234
