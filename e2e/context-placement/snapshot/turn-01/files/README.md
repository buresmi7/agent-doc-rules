# Habitat Importer

Habitat Importer reads CSV exports from field teams and writes normalized
species observations to JSON files.

## Documentation

- [Observation schema](docs/schema.md) describes accepted CSV input and JSON
  output.
- [Output format rationale](docs/output-format.md) explains why imports produce
  JSON.
- [Troubleshooting](docs/troubleshooting.md) covers fixture failures.

## Verification

Run `npm test` before changing parser behavior.
