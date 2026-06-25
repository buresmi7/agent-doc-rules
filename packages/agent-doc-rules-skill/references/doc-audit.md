# Documentation Audit

Use this reference when repairing existing repository docs, triaging notes, or
moving facts between README, `AGENTS.md`, `docs/`, and skills.

## Audit Pass

Before editing, make one inventory of durable facts:

| Fact | Source | Canonical home | Action |
| --- | --- | --- | --- |
| What the project does | `README.md` | `README.md` | Keep or tighten |
| Local safety rule | `AGENTS.md` | `AGENTS.md` | Preserve |
| Long release procedure | `README.md` | `docs/release.md` | Move and link |
| Repeated agent workflow | `notes.md` | `.agents/skills/<name>/SKILL.md` | Extract |

Use the table as a working note. Do not add it to the repository unless the user
asked for an audit report.

## Evidence Rules

- Treat manifests, config files, existing docs, and explicit user instructions
  as evidence.
- Verify documented commands against manifests such as `package.json` when one
  exists.
- Do not infer hidden harness commands such as `test:agent`; a script belongs in
  docs only when the target manifest or user request supports it.
- Preserve supported project-specific facts even when rewriting the surrounding
  prose.
- Remove or label unsupported commands, integrations, hosts, issue workflows, and
  services.
- Do not preserve secrets, private host names, customer identifiers, account IDs,
  tokens, or environment-specific machine notes.

## Placement Decisions

- Keep human orientation and first useful commands in `README.md`.
- Move long setup, release, repair, and troubleshooting procedures to `docs/`.
- Keep always-needed agent routing, local invariants, and verification rules in
  `AGENTS.md`.
- Move repeated agent workflows with steps, inputs, outputs, or review rules to a
  task-specific skill.
- Reduce inbox files such as `notes.md` to a short pointer after durable facts
  move.

## Final Review

Before finishing, check that:

- compliant files were left unchanged instead of rewritten for style,
- each moved fact has one canonical home,
- source files no longer duplicate durable facts,
- links point from short entry files to the new canonical homes,
- command guidance is verified or marked as unavailable,
- skipped checks include a reason and remaining risk.
