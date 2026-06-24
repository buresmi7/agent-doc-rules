# AGENTS.md

## Shared Rules

Use `.agents/skills/agent-doc-rules/references/agents-md.md` for shared agent
instruction guidance.

## Project Routing

- Read `README.md` for the project purpose and documentation index.
- Read `docs/schema.md` before changing parser output.
- Keep parser rationale in `docs/import-design.md`.
- Keep fixture repair steps in `docs/troubleshooting-fixtures.md`.

## Local Invariants

- Do not mention private site names in public docs.
- Keep generated JSON examples out of commits when they include real site names.

## Verification

Run `npm test` before changing parser behavior. If a relevant check is skipped,
record the reason and residual risk in the handoff.
