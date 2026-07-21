# Harbor Backup Notes - AI Agent Instructions

Harbor Backup Notes is a documentation-only repository for staging SQLite
backup restore notes used during local documentation checks.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)

## Local Rules

- Keep the staging restore procedure in `docs/restore-staging-backup.md`; do not
  copy the full runbook into agent instructions.
- Do not commit backup files, customer data, production data, private host names,
  tokens, or environment-specific values.
- Do not paste real customer data into examples or generated documentation.

## Source Of Truth

| Document | Purpose |
| --- | --- |
| `README.md` | Project overview and verification command |
| `docs/restore-staging-backup.md` | Human staging restore procedure |

## Verification

Run the documentation check before finishing doc changes:

```bash
npm run docs:check
```

If a check cannot run, report the blocker and what remains unverified.
