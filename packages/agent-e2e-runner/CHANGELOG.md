# Changelog

## 0.12.0

### Minor Changes

- 652848d: Add a dependency-free, browser-safe package for the versioned `report.json`
  contract and validator. Checkpoint that document throughout every agent
  scenario with prompts, responses, expectations, tool summaries, per-turn
  unified diffs, the final diff, and the judgment or runtime error. Store passing
  agent snapshots as one `snapshot/report.json` file.

  Replace `failure-summary.json`, the CLI `summary:` label, and the
  `failureSummaryPath` result field with `report.json`, the CLI `report:` label,
  and the `reportPath` result field. A private static viewer workspace consumes
  the same public contract without adding browser dependencies to the runner.

- 59bdb3d: Store E2E run output under each scenario by default, with CLI and environment
  overrides for another output root. Keep the skill installer cache within the
  run directory and exclude generated run directories from documentation input.

### Patch Changes

- Updated dependencies [652848d]
  - @buresmi7/agent-e2e-report@0.1.0

## 0.11.1 - 2026-07-30

### Patch Changes

- Add GitHub repository, package homepage, and issue tracker links to the
  published package metadata.

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
