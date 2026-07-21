---
name: release-notes
description: Use when drafting Atlas CLI release notes from the changelog and merged pull request input.
---

# Release Notes

Use this skill to draft `docs/releases/<version>.md` for an Atlas CLI release.

## Inputs

- `CHANGELOG.md`
- `docs/release-input.md`

## Workflow

1. Read `CHANGELOG.md`.
2. Read merged pull request titles from `docs/release-input.md`.
3. Group changes into `Added`, `Changed`, `Fixed`, and `Removed`.
4. Keep customer names and private issue links out of release notes.
5. Write `docs/releases/<version>.md`.
6. If the release input is incomplete, write a short residual-risk note instead
   of inventing missing changes.

## Verification

Run `npm test` before publishing release documentation changes. If the check
cannot run, record the blocker and what remains unverified.
