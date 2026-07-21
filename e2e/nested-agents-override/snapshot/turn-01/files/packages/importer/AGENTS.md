# Beacon Importer - AI Agent Instructions

Beacon Importer converts partner CSV files into normalized JSON records.

## Local Rules

- Read `packages/importer/docs/schema.md` before changing parser output.
- Keep sample rows anonymous.
- Do not add real partner data, account IDs, private host names, or secrets to
  importer docs, examples, or fixtures.

## Verification

- Run `npm run test:importer` from the workspace root before finishing importer
  behavior changes.
- If the check cannot run, say why and note what importer behavior remains
  unverified.
