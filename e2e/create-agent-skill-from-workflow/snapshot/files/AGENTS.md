# Atlas Release Notes - AI Agent Instructions

Atlas Release Notes keeps release summaries for the Atlas CLI.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-md.md)
- [README rules](.agents/skills/agent-doc-rules/references/readme.md)

## Local Rules

- Use the [release notes skill](.agents/skills/release-notes/SKILL.md) when drafting
  `docs/releases/<version>.md`.
- Keep detailed release drafting steps out of `README.md`; the skill is the
  canonical workflow.

## Source Of Truth

- `CHANGELOG.md` lists current unreleased changes.
- `docs/release-input.md` lists release input gathered from merged pull requests.
- `README.md` is the human entry point and documentation index.

## Verification

Run `npm test` before publishing release documentation changes. If the check cannot
run, state why and include the remaining risk.
