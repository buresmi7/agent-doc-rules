# Documentation Inbox

These notes need a durable home.

- New contributors need to know that the project converts field-team CSV files
  into normalized JSON observations.
- The parser accepts UTF-8 CSV input with the columns `species`, `site`,
  `observed_at`, and `count`.
- The parser drops rows with empty `species` values and records the row number
  in the import report.
- Maintainers should keep generated JSON examples out of commits when they
  include real site names.
- Agents should read `docs/schema.md` before changing parser output.
- The reason for JSON output is that downstream review tools do not agree on a
  CSV dialect.
- If a fixture fails, run `npm test` and inspect the failing row number before
  changing schema docs.
- Do not mention private site names in public docs.
