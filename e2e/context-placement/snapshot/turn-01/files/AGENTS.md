# Habitat Importer - AI Agent Instructions

Habitat Importer converts field-team CSV files into normalized JSON species
observations.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)

## Local Rules

- Read [docs/schema.md](docs/schema.md) before changing parser output.
- Do not commit generated JSON examples that include real site names.
- Do not mention private site names in public docs.

## Source Of Truth

- [README.md](README.md) is the human entry point.
- [docs/schema.md](docs/schema.md) owns the CSV input and JSON output contract.
- [docs/output-format.md](docs/output-format.md) owns the JSON output rationale.
- [docs/troubleshooting.md](docs/troubleshooting.md) owns fixture failure
  repair guidance.

## Verification

- Run `npm test` before changing parser behavior.
- If a check cannot run, state the blocker and what remains unverified.
