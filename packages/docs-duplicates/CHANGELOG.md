# Changelog

## 0.11.0 - 2026-07-24

- Published the `0.10.0` duplicate checker unchanged in the final lockstep
  release.

## 0.10.0 - 2026-07-21

- Published the `0.9.0` duplicate checker unchanged as part of the lockstep
  release.

## 0.9.0 - 2026-07-14

- Added optional `ignorePairs.reason` strings so a configured duplicate
  exclusion can link to its durable rationale.
- Validated reason values and preserved them while normalizing ignore pairs.

## 0.8.2 - 2026-06-28

- Published the duplicate checker on npm for the first time under
  `@buresmi7/agent-doc-rules-docs-duplicates`.
- Shipped deterministic candidate selection, Codex-backed semantic review,
  sentence-level style review, and configured ignore pairs in the public
  package.

## Pre-publication history

The duplicate checker first appeared on npm at `0.8.2`. The entries below
record its private `0.1.0` workspace history under
`@agent-doc-rules/docs-duplicates`.

### Repository v0.7.0 - 2026-06-28

- Added symmetric `ignorePairs` patterns for narrow, documented exclusions
  before candidates are sent to Codex.

### Repository v0.6.0 - 2026-06-26

- Added Codex-backed sentence-level style review as the `style` command.
- Added shared configuration and tests for style findings.

### Repository v0.3.0 - 2026-06-24

- Added the initial semantic duplicate checker with deterministic candidate
  selection and structured Codex review.
