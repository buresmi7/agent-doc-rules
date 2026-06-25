# Harbor Backup Notes

Harbor Backup Notes records how human maintainers restore a staging SQLite
backup for local documentation checks.

## Everything

This repository is documentation-only. It has one useful check:

```bash
npm run docs:check
```

The restore notes below are for human maintainers. They are not an agent
drafting workflow.

Before a staging restore, confirm that the backup file was exported from the
staging system, not production. Put the file in `tmp/restore/` and keep it out
of Git. Open the local admin screen, choose the staging environment, import the
SQLite file, run the smoke query, and delete the temporary file. Never paste
real customer data into examples or generated documentation.

Agents should not copy this whole procedure into `AGENTS.md`.
