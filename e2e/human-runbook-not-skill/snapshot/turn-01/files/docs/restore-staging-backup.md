# Restore A Staging Backup

This procedure is for human maintainers who need to restore a staging SQLite
backup for local documentation checks.

## Safety Rules

- Confirm the backup file was exported from staging, not production.
- Keep the backup file in `tmp/restore/`.
- Do not commit backup files.
- Do not paste real customer data into examples or generated documentation.

## Procedure

1. Put the staging SQLite backup file in `tmp/restore/`.
2. Open the local admin screen.
3. Choose the staging environment.
4. Import the SQLite file.
5. Run the smoke query.
6. Delete the temporary backup file.
