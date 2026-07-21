# Habitat Importer - AI Agent Instructions

Habitat Importer reads field-team CSV exports and writes normalized species
observations as JSON.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [Documentation architecture](.agents/skills/agent-doc-rules/references/documentation-architecture.md)

## Local Rules

- Read [docs/schema.md](docs/schema.md) before changing parser output.
- Do not mention private site names in public docs.
- Keep generated JSON examples out of commits when they include real site names.

## Source Of Truth

- [README.md](README.md) is the human entry point.
- [docs/schema.md](docs/schema.md) owns parser input, output, and import report
  behavior.
- [docs/architecture.md](docs/architecture.md) owns output-format rationale.
- [docs/troubleshooting.md](docs/troubleshooting.md) owns fixture failure
  checks.

## Verification

- Run `npm test` before changing parser behavior.
- If a check cannot run, state the blocker and what remains unverified.
