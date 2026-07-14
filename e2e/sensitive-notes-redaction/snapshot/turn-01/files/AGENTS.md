# Agent Instructions

## Project Context

Ledger Scrubber validates exported ledger CSV files before local analysis.

## Documentation Rules

Use anonymized examples in repository docs. Do not include customer identifiers,
account IDs, private hosts, tokens, or environment-specific fixture values in
reusable documentation.

## Verification

Run `npm test` before changing parser behavior. If a relevant check is skipped,
state why and note the residual risk.

## Skill Reference

Follow the shared AGENTS.md guidance in
`.agents/skills/agent-doc-rules/references/agents-rules.md`.
