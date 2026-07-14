# Harbor Backup Notes

Harbor Backup Notes is a documentation-only repository for human maintainer
notes about restoring a staging SQLite backup for local documentation checks.

## Canonical Docs

| Document | Content |
| --- | --- |
| `README.md` | Project overview and first verification command |
| `AGENTS.md` | Agent routing, local rules, and verification guidance |
| `docs/staging-sqlite-restore.md` | Human staging SQLite restore runbook |

## Verification

Run the documentation check before publishing documentation changes:

```bash
npm run docs:check
```

## Project Notes

The staging restore procedure is for human maintainers. It is not an agent
drafting workflow, and agents should not copy the full procedure into
`AGENTS.md`.

Never paste real customer data into examples or generated documentation.
