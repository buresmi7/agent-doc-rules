# Habitat Importer - AI Agent Instructions

Habitat Importer converts field-team CSV files into normalized JSON species
observations.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-md.md)

## Local Rules

- Read [docs/schema.md](docs/schema.md) before changing parser output.
- Follow [docs/data-safety.md](docs/data-safety.md) before adding examples or
  public docs with site data.

## Source Of Truth

- [docs/schema.md](docs/schema.md) defines CSV input and observation JSON fields.
- [docs/output-format.md](docs/output-format.md) explains why output is JSON.
- [docs/data-safety.md](docs/data-safety.md) is canonical for site-name safety.
- [docs/troubleshooting.md](docs/troubleshooting.md) covers fixture failures.

## Verification

- Run `npm test` before changing parser behavior.
- For fixture failures, use [docs/troubleshooting.md](docs/troubleshooting.md).
- If a required check cannot run, state why and document the remaining risk.
