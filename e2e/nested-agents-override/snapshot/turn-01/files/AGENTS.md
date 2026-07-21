# Beacon Workspace - AI Agent Instructions

Beacon Workspace is a private Node workspace with a small API notes package and
a CSV importer package.

## Shared Rules

- Follow the shared [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md).

## Local Rules

- Keep package-specific instructions beside the package they govern.
- Before editing `packages/importer/`, read `packages/importer/AGENTS.md`.
- Do not commit secrets, private host names, real partner data, or account IDs
  in docs, examples, or fixtures.

## Source Of Truth

- `README.md` describes the workspace and package layout.
- `packages/api/README.md` describes the API notes package.
- `packages/importer/README.md` describes importer behavior.
- `packages/importer/docs/schema.md` defines importer input columns and output
  fields.

## Verification

- Run `npm test` from the workspace root before finishing broad workspace
  changes.
- If a relevant check cannot run, say why and note what risk remains.
