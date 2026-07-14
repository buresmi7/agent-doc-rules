# Habitat Importer

Habitat Importer reads CSV exports from field teams and writes normalized
species observations to JSON files.

## Documentation

- [Importer input](docs/importer.md) describes accepted CSV columns and skipped
  rows.
- [Observation schema](docs/schema.md) describes the JSON observation shape.
- [Output format](docs/output-format.md) explains why the importer writes JSON.
- [Troubleshooting](docs/troubleshooting.md) covers fixture failure checks.

## Verification

Run `npm test` before changing parser behavior.
