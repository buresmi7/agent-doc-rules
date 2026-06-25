# Beacon Workspace - AI Agent Instructions

Beacon Workspace contains a small API package and a CSV importer package.

## Shared Rules

- Follow the installed [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md).

## Local Rules

- Keep package-specific rules near the package they govern.
- Before changing `packages/importer/`, read `packages/importer/AGENTS.md`.
- Preserve existing package README facts; do not invent hidden services or workflows.

## Source Of Truth

- `README.md` lists workspace packages and root verification.
- `packages/api/README.md` describes the API notes package.
- `packages/importer/README.md` describes importer behavior.
- `packages/importer/docs/schema.md` defines importer input and output fields.

## Verification

- Run `npm test` from the workspace root for general changes.
- If a check cannot run, document the reason and remaining risk before finishing.
