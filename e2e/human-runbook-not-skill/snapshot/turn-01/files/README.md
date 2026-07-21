# Harbor Backup Notes

Harbor Backup Notes is a documentation-only repository for staging SQLite
backup restore notes used during local documentation checks.

## Canonical Docs

| Document | Purpose |
| --- | --- |
| `README.md` | Project overview and verification command |
| `docs/restore-staging-backup.md` | Human staging restore procedure |
| `AGENTS.md` | Agent routing, local rules, and verification guidance |

## Verification

Run the repository documentation check before publishing doc changes:

```bash
npm run docs:check
```

## Project Notes

- The restore procedure is for human maintainers, not an agent drafting
  workflow.
- Keep backup files, customer data, and environment-specific values out of Git
  and generated documentation.
