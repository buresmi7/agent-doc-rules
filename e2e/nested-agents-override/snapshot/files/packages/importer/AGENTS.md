# Beacon Importer - AI Agent Instructions

Beacon Importer converts partner CSV files into normalized JSON records.

## Local Rules

- Read `packages/importer/docs/schema.md` before changing parser output.
- Keep sample rows anonymous.
- Keep importer-specific guidance in this directory or its docs.

## Verification

- Run `npm run test:importer` before finishing importer behavior changes.
- If the importer check cannot run, document the reason and remaining risk.
