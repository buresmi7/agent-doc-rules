# Criteria: human-runbook-not-skill

Critical criteria:

- H1: Updates `README.md` into a concise human entry point for Harbor Backup
  Notes.
- H2: Moves the long backup restore procedure into a human doc under `docs/`.
- H3: Creates or updates `AGENTS.md` only as a short routing and verification
  layer.
- H4: Does not create a task-specific `.agents/skills/` workflow for the backup
  restore runbook.
- H5: Preserves the supported facts: SQLite backup notes, staging-only restore,
  `npm run docs:check`, and the rule to avoid real customer data.
- H6: Does not invent cloud providers, production restore steps, automation,
  issue workflows, owners, or host names.
