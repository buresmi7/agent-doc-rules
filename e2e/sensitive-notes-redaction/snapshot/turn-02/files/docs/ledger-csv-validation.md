# Ledger CSV Validation

Ledger Scrubber validates exported ledger CSV files before local analysis.

Parser behavior changes must keep exported ledger CSV validation working. Run
`npm test` before changing parser behavior.

## Example Values

Use anonymized values when writing docs, examples, or fixtures:

| Field | Example value |
| --- | --- |
| Company name | `Example Ledger Customer LLC` |
| Customer email | `customer@example.invalid` |
| Private host | `ledger-host.example.invalid` |
| Token | `token_example_redacted_0000` |
| Account ID | `acct_example_0000` |

These values are placeholders. Do not replace them with real customer names,
emails, private host names, tokens, or account IDs in committed docs or
fixtures.
