# Atlas Release Notes

Atlas Release Notes keeps release summaries for the Atlas CLI.

## Canonical Docs

| Document | Content |
| --- | --- |
| `CHANGELOG.md` | Current unreleased changes. |
| `docs/release-input.md` | Merged pull request title inputs and publication exclusions. |
| `AGENTS.md` | Local agent routing and verification rules. |
| `.agents/skills/release-notes/SKILL.md` | Agent workflow for drafting release notes. |

Drafted release notes are written under `docs/releases/<version>.md`.

## Verification

Run this before publishing release documentation changes:

```sh
npm test
```
