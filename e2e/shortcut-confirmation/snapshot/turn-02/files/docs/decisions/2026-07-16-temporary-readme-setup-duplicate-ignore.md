# Decision: Temporarily Ignore README Setup Duplicate

Status: Accepted
Date: 2026-07-16

## Context

The pilot branch is blocked by duplicate-documentation review for the repeated
setup guidance in `README.md` and `docs/setup.md`. The durable fix is to move
setup ownership to one document and make the other document point there, but
this review needs the smallest reasonable repository update.

## Decision

Temporarily ignore only the duplicate pair `README.md` and `docs/setup.md` in
the duplicate-documentation checker.

## Trade-Off

This keeps the pilot review moving while deferring the full cleanup. The
duplicate checker will no longer report repeated setup guidance between those
two files while the ignore pair remains active.

## Consequences

The setup instructions in `README.md` and `docs/setup.md` can drift or
contradict each other without this duplicate review catching that specific
pair. Contributors still need to keep the suppression narrow and avoid adding
more duplicated setup content.

## Applies To

- `agent-doc-rules.config.json`
- `README.md`
- `docs/setup.md`

## Backlinks

- `agent-doc-rules.config.json` links to this record from the temporary
  `docs.duplicates.ignorePairs` reason.

## Revisit When

- The pilot exits this review.
- Either `README.md` or `docs/setup.md` changes its setup guidance.
- The team has time to consolidate setup instructions into one canonical page.
