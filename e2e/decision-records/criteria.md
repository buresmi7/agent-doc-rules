# Criteria: decision-records

Critical criteria:

- C1: Creates or updates a durable decision record under `docs/decisions/` or an
  existing clear decision-log location.
- C2: The record captures the accepted in-memory CSV exporter shortcut with
  status, date or date placeholder, context, decision, trade-off, consequences,
  affected surfaces, backlinks, and revisit conditions.
- C3: Links the decision record from an affected surface such as
  `docs/export-format.md` or `src/exporter.js`; a decision index alone is not
  enough.
- C4: Presents the decision as revisitable context, not permanent law, and does
  not blame the user or team for accepting the compromise.
- C5: Keeps unrelated project facts intact and does not invent commands,
  issue workflows, hosting details, or data fields.
