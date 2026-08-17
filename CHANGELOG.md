# Repository Changelog

This file records repository structure, release management, shared maintainer
tooling, and monorepo E2E fixtures. Package behavior and publication history
live in the package changelogs:

- [`@buresmi7/agent-doc-rules-skill`](packages/agent-doc-rules-skill/CHANGELOG.md)
- [`@buresmi7/agent-e2e-runner`](packages/agent-e2e-runner/CHANGELOG.md)
- [`@buresmi7/agent-e2e-report`](packages/agent-e2e-report/CHANGELOG.md)
- [`@buresmi7/agent-doc-rules-docs-validator`](packages/docs-validator/CHANGELOG.md)
- [Retired docs duplicate checker](docs/retired/docs-duplicates-changelog.md)

## Unreleased

- Retired the duplicate-checker workspace and archived its package history
  after removing it from active release metadata.
- Documented `v0.11.0` as the final lockstep release, reconciled legacy tags
  with GitHub Releases, and defined independent versioning for later package
  releases.
- Added Changesets metadata, package-specific tag identities, and release
  checks for prepared, tagged, and published package versions.
- Moved package history into package changelogs and limited this file to
  repository and monorepo changes.
- Required every public package manifest to expose its GitHub repository,
  package homepage, and issue tracker.
- Exercised the independent release workflow with package-specific tags and
  GitHub Releases, with a recorded one-release verification exception for the
  metadata-only `0.11.1` release.
- Shortened package-specific GitHub Release titles and replaced one-row package
  tables with versioned npm links.
- Made each package's current changelog entry the source of its GitHub Release
  notes and added a check that rejects rewritten summaries.

## v0.11.0 - 2026-07-24

- Expanded the context-placement E2E scenario to reject chat framing,
  interaction-only files, and unsupported schema or troubleshooting claims.
- Added a GitHub release template that listed every public package and drew
  user-visible notes from the matching release entry.

## v0.10.0 - 2026-07-21

- Replaced the repository-local agent and command scenario runtime with a
  workspace dependency on the publishable E2E runner.
- Migrated repository fixtures to normal skill-package dependencies and one
  `scenario.json` with ordered prompts and named criteria.
- Allowed two isolated agent scenarios to run concurrently while retaining a
  documented serial command for rate-limited CI environments.
- Expanded the factual-review and sensitive-note fixtures into multi-turn flows
  that test changed decisions and rejected requests to restore sensitive data.

## v0.9.0 - 2026-07-14

- Added multi-turn agent E2E scenarios with per-turn snapshots, including a
  shortcut-confirmation flow.
- Removed explicit skill-selection hints from prompts so scenarios exercise
  natural skill discovery.
- Moved snapshots to `snapshot/turn-XX/` directories and removed the old
  `snapshot/files/` layout.
- Made the full agent E2E script run scenario projects serially to reduce
  model-backed runner noise.
- Tightened root agent instructions and fixture guidance in response to E2E
  failures.

## v0.8.2 - 2026-06-28

- Updated E2E fixtures to use the public npm names for the validator and
  duplicate checker.
- Added package artifact checks and pack dry-runs to the static release gate.

## v0.8.0 - 2026-06-28

- Added installer tests and a package dry-run to the static skill verification
  path.

## v0.7.0 - 2026-06-28

- Added command E2E security fixtures with stdout and stderr snapshot
  expectations.
- Tightened maintainer docs and repository instructions so expected duplicate
  and style warnings stay out of validation output.

## v0.6.0 - 2026-06-26

- Added a maintainer project-cleanup checklist and linked it from development
  docs and agent instructions.
- Split the repository's agent E2E runtime into modules for agent execution,
  prompts, project files, skill installation, and process helpers.
- Added deterministic command scenarios for prepared fixture projects.
- Isolated Codex agent E2E subprocesses from maintainer-local Codex
  configuration and home-directory rules.
- Added E2E runtime utility tests to the default static test gate.
- Added maintainer docs for E2E failure triage, rule placement, and
  scenario-to-rule coverage.
- Added `verify:release` to run skill sync, installation smoke tests, static
  checks, docs validation, and agent E2E tests.
- Documented the source and inspiration links for project-scoped maintainer
  skills.
- Added generated `failure-summary.json` files to agent E2E failure output.

## v0.5.0 - 2026-06-25

- Added a factual-change-rejection E2E scenario and passed generator notes to
  the E2E judge.
- Moved monorepo maintainer detail from the root README to
  `docs/development.md`, leaving the root README as a short entry point.

## v0.4.0 - 2026-06-25

- Made the root README point to the skill package as the main product entry
  point.
- Added a static skill artifact check for metadata, links, package contents,
  stale paths, and OpenAI prompt metadata.
- Added E2E boundary scenarios for no-op review, nested agent overrides, human
  runbooks, stale README commands, and sensitive-note redaction.

## v0.3.0 - 2026-06-24

- Added the validator and duplicate checker as private workspace packages.
- Added `agent-doc-rules.config.json` as shared documentation-validation
  configuration.
- Added an E2E scenario for documentation-validation routing.
- Added model, reasoning effort, runner, CLI, and `skills` CLI versions to E2E
  snapshot metadata.

## v0.2.0 - 2026-06-24

- Refactored the repository into a pnpm monorepo with the Agent Skill under
  `packages/agent-doc-rules-skill/`.
- Moved each E2E fixture project into its own workspace package with a
  `workspace:*` dependency on the skill.
- Added a root workspace dependency and local sync script for the skill.
- Moved the shared agent E2E runtime into `tools/` and added a local
  installation smoke test.
- Updated E2E scenarios to install their workspace skill dependency with
  `npx skills add`.
- Added project-scoped maintainer skills, `skills-lock.json`, and restoration
  of npm-sourced skills from the skill workspace.
- Refocused the root README on monorepo goals and maintainer workflow.
- Generalized the E2E harness for multi-file documentation changes and added
  scenarios for README splitting, context placement, skill extraction,
  plain-English cleanup, and local language overrides.

## Pre-monorepo repository history

Package content from the `v0.1.x` source releases is recorded in the
[skill changelog](packages/agent-doc-rules-skill/CHANGELOG.md). The entries
below cover only repository validation and E2E infrastructure.

### v0.1.6 - 2026-06-17

- Made static checks the default release gate.
- Switched the prepared agent E2E harness to the available Codex CLI by
  default.
- Kept the Ollama-compatible local model path as an explicit optional runner.

### v0.1.5 - 2026-06-17

- Replaced the static content check and advisory model review with an E2E agent
  test.
- Added create and repair scenarios that import the rules into temporary
  projects and judge generated `AGENTS.md` output with a local model.
- Updated the root README's validation guidance for the default test gate and
  optional local model.

### v0.1.4 - 2026-06-17

- Added deterministic Markdown, link, and content-validation scripts.
- Added optional local Ollama-backed review.
- Documented the repository validation commands in the root README.
- Added a small npm audit gate with explicit accepted development-tool
  advisories.
