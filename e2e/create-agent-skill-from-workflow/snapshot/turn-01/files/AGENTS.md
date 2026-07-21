# Atlas Release Notes - AI Agent Instructions

Atlas Release Notes keeps release summaries for the Atlas CLI.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [Documentation architecture](.agents/skills/agent-doc-rules/references/documentation-architecture.md)

## Local Rules

- Use the [release notes skill](.agents/skills/release-notes/SKILL.md) when
  drafting `docs/releases/<version>.md`.
- Keep customer names and private issue links out of committed release notes.

## Source Of Truth

- [README](README.md) describes the project and release-documentation check.
- [CHANGELOG](CHANGELOG.md) and [release input](docs/release-input.md) provide
  release-note source material.

## Verification

- Run `npm test` before publishing release documentation changes.
- If a check cannot run, state the blocker and what remains unverified.
