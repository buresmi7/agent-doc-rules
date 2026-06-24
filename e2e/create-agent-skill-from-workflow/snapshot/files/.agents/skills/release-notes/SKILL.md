---
name: release-notes
description: Draft Atlas CLI release notes from the changelog and release input.
---

# Release Notes

Use this skill when drafting or updating Atlas CLI release notes in
`docs/releases/<version>.md`.

## Workflow

1. Read `CHANGELOG.md`.
2. Read merged pull request titles from `docs/release-input.md`.
3. Group changes into Added, Changed, Fixed, and Removed.
4. Keep customer names and private issue links out of release notes.
5. Write `docs/releases/<version>.md`.
6. If the release input is incomplete, write a short residual-risk note instead
   of inventing missing changes.

## Verification

Run `npm test` before publishing release documentation changes. If the check
cannot run, state why and include the remaining risk.
