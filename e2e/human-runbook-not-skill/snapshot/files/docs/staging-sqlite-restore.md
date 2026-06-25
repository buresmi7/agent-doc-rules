# Staging SQLite Restore

This runbook is for human maintainers who restore a staging SQLite backup for
local documentation checks.

## Safety Boundaries

- Confirm that the backup file was exported from the staging system, not
  production.
- Put the backup file in `tmp/restore/` and keep it out of Git.
- Never paste real customer data into examples or generated documentation.

## Procedure

1. Put the staging SQLite backup file in `tmp/restore/`.
2. Open the local admin screen.
3. Choose the staging environment.
4. Import the SQLite file.
5. Run the smoke query.
6. Delete the temporary backup file.
