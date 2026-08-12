# Atlas Release Notes

Atlas Release Notes keeps release summaries for the Atlas CLI.

Run `npm test` before publishing release documentation changes.

## Release note drafting

This workflow is repeated every release and is meant for the coding agent:

1. Read `CHANGELOG.md`.
2. Read merged pull request titles from `docs/release-input.md`.
3. Group changes into Added, Changed, Fixed, and Removed.
4. Keep customer names and private issue links out of release notes.
5. Write `docs/releases/<version>.md`.
6. If the release input is incomplete, write a short residual-risk note instead
   of inventing missing changes.

The README should not carry this whole workflow forever.
