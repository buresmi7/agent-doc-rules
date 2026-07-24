# Changelog

## 0.11.0 - 2026-07-24

- Kept resumed multi-turn Codex sessions writable so confirmed follow-up
  changes can be applied while the separate judge remains read-only.

## 0.10.0 - 2026-07-21

- Published the initial CLI and library API for agent scenarios and
  deterministic command scenarios.
- Read the selected skill package and version from each fixture's normal
  dependencies and accepted the package and skill through CLI flags.
- Ran agent turns in persistent Codex sessions and evaluated them with a
  separate read-only Codex judge.
- Standardized agent scenarios on one `scenario.json` with ordered prompts and
  named per-turn criteria.
- Captured per-turn responses, safe tool activity, project diffs, protected
  skill and lockfile inputs, and isolated Codex authentication.
- Added the five-turn dictated-todo example for conflicts and clarification
  before unresolved tasks are written.
