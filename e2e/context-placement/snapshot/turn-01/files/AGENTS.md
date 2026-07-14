# Habitat Importer Agent Instructions

Habitat Importer reads field-team CSV exports and writes normalized species
observations as JSON files.

## Shared Rules

Follow the shared repository documentation rules in
[agent-doc-rules](.agents/skills/agent-doc-rules/references/agents-rules.md).

## Local Rules

- Read [docs/schema.md](docs/schema.md) before changing parser output.
- Run `npm test` before changing parser behavior.
- If a required check is skipped, record the blocker and what remains
  unverified.
- Keep generated JSON examples out of commits when they include real site names.
- Do not mention private site names in public docs.

## Troubleshooting

Use [docs/troubleshooting.md](docs/troubleshooting.md) when fixture tests fail.
