# Ledger Scrubber - AI Agent Instructions

Ledger Scrubber validates exported ledger CSV files before local analysis.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)

## Local Rules

- Use anonymized examples in committed docs, examples, and generated fixtures.
- Do not commit real or private customer names, emails, host names, tokens, or
  account IDs.

## Source Of Truth

- [README](README.md) is the human entry point.
- [Ledger CSV validation](docs/ledger-csv-validation.md) owns the parser
  validation contract.

## Verification

- Run `npm test` before changing parser behavior.
- Run `npm run docs:check` after changing README, docs, or agent instructions.
- If a check cannot run, record the blocker and what remains unverified.
