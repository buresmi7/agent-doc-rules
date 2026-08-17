# Decision Records

Use this reference when a repository needs to record an accepted trade-off,
rule exception, user-approved shortcut, skipped verification, or other decision
that will affect future maintenance.

## Core Rule

Do not hide the cost of a shortcut.

If a faster path knowingly sacrifices quality, skips required checks, violates a
rule, or creates hidden debt, tell the user before proceeding. Explain the
trade-off, consequences, remaining risk, and repair path. Continue only after
explicit user confirmation.

Make the repair path concrete and evidence-backed. Name the work that will
remove the compromise and the affected files or systems. Saying that cleanup
can happen later is not a repair path. For duplicate-documentation
suppressions, identify the canonical page, the files that will replace
duplicated text with links to it, and the validation exception that will then
be removed.

For validation suppressions, name the exact finding the tool will stop
reporting and the drift or defect that may grow while the suppression is active.

Treat a question about whether a shortcut is possible as a request for
evaluation, not as confirmation. Confirmation is valid only after the user has
seen the described trade-off and then accepts it. End the pre-confirmation
response with a direct yes-or-no question asking whether the user explicitly
accepts the compromise. If the confirmed change would need a linked decision
record, say that before asking for confirmation.

When a config entry allows a known finding to remain, name the issue the tool
will stop reporting while that entry is active. Committed config exceptions,
allowlist entries, `ignorePairs`, and validation suppressions always count as
lasting effects while they remain in the repository, so they need a linked
decision record after confirmation.

Record confirmed compromises when they have a lasting effect. A chat message is
not durable project memory.

## When To Record

Create or update a decision record when the confirmed choice:

- creates technical or documentation debt,
- accepts weaker correctness, maintainability, security, accessibility, or
  test coverage,
- skips a required or expected verification step,
- makes an exception to a project rule,
- adds a config exception, documented allowlist entry, or other setting that
  leaves a known issue in place,
- chooses a simpler design that future maintainers may reasonably question,
- affects architecture, data shape, public APIs, release behavior, or
  agent-facing instructions.

Do not create a decision record for ordinary implementation choices, local
style edits, reversible cleanup, or low-risk work that already follows project
rules.

## Where To Put It

Use the repository's existing decision-log location when it has one. If it does
not, prefer `docs/decisions/` for durable decision records and add a short index
only when multiple records exist.

Keep decision records human-facing. `AGENTS.md` may point to the decision log,
but should not carry the full record.

## Active Records Need Backlinks

An active decision record must be discoverable from the thing it explains.

A decision record is authoritative only while it is linked from affected code,
configuration, documentation, or agent instructions. A link from a decision
index alone is not enough.

When the affected surface is code, add an inline link only when the code would
look wrong or arbitrary without context. Otherwise, link from the nearest stable
architecture, API, configuration, or maintenance doc that describes that code.

If no affected surface should link to the record anymore, mark it as
`Superseded` or `Archived`. Treat orphaned active records as historical context,
not current project constraints.

## Required Content

Each decision record should include:

- title,
- status, such as `Accepted`, `Superseded`, or `Archived`,
- date,
- context,
- decision,
- trade-off and consequences,
- affected surfaces,
- links from affected surfaces back to this record,
- revisit or replacement conditions.

Name the user-approved compromise without blaming the user. The point is to
preserve project memory, not to create cover for poor work.

## Revisiting Decisions

Treat a decision record as context, not permanent law.

When a later task touches the affected area, tell the user what trade-off was
accepted, whether it still applies, and whether the project should keep,
replace, or supersede the decision.

Use [`../assets/templates/decision-record.md`](../assets/templates/decision-record.md)
as a starting point when the repository has no local format.
