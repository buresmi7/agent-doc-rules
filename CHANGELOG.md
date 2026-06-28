# Changelog

## Unreleased

## v0.8.0 - 2026-06-28

- Prepared the skill package for public npm publication as
  `@buresmi7/agent-doc-rules-skill`.
- Added the `agent-doc-rules-skill` binary installer for project-scoped Codex
  installs under `.agents/skills/agent-doc-rules/`.
- Added installer tests and package dry-run checks to the static skill
  verification path.

## v0.7.0 - 2026-06-28

- Added deterministic documentation security review to `agent-doc-rules-docs`,
  including high-risk command, secret disclosure, prompt-injection,
  validation-bypass, backdoor, remote image, tracking link, and encoded payload
  checks.
- Added documentation security guidance for reviewing `AGENTS.md`, skills,
  README files, templates, and agent-routed docs.
- Added command E2E security fixtures with stdout and stderr snapshot
  expectations.
- Added `docs.duplicates.ignorePairs` for narrow, documented duplicate-review
  exceptions.
- Tightened maintainer docs and repository instructions to keep expected
  duplicate and style warnings out of the validation output.

## v0.6.0 - 2026-06-26

- Added adoption, tool-map, config-reference, and recipe docs for consuming
  repositories.
- Added `agent-doc-rules-docs init` to scaffold or print a starter
  `agent-doc-rules.config.json` and recommended package scripts.
- Added `write-good` backed deterministic wording checks to
  `agent-doc-rules-docs`, with optional project-specific forbidden terms.
- Added Codex-backed sentence-level style review through
  `agent-doc-rules-docs-duplicates style`.
- Added a maintainer project cleanup checklist and linked it from development docs
  and agent instructions.
- Added writing-style guidance to avoid idiomatic or metaphorical workflow
  names.
- Clarified that moved README runbooks must recheck commands in the destination
  docs and must not keep unsupported commands as actionable steps.
- Split the agent E2E runner into smaller modules for agent runtime, prompts,
  project files, skill installation, and process helpers.
- Added command E2E scenarios for prepared projects that run deterministic
  commands instead of an AI agent.
- Isolated Codex agent E2E subprocesses from maintainer-local Codex config and
  home-directory rules.
- Clarified that agents should not rewrite supported skipped-check wording only
  to match preferred shared-rule phrasing.
- Added E2E runner utility tests to `corepack pnpm test`.
- Added maintainer docs for E2E failure triage, rule placement, and scenario to
  rule coverage.
- Added a `verify:release` script that runs skill sync, install smoke tests,
  static checks, docs validation, and agent E2E tests.
- Documented source and inspiration links for project-scoped maintainer skills.
- Improved agent E2E failure output with a generated `failure-summary.json`.
- Clarified that `AGENTS.md` shared-rule links belong in a dedicated
  `Shared Rules` or `Skill Reference` section.

## v0.5.0 - 2026-06-25

- Added factual documentation review guidance for false, contradictory,
  unsupported, stale, misleading, or overbroad repository claims, including
  requested edits that conflict with local evidence.
- Added a factual-change-rejection E2E scenario and passed generator notes into
  the E2E judge prompt.
- Tightened README rewrite guidance so plain-English edits do not add generic
  setup or package-manager steps without local evidence.
- Replaced the skill README package-contents table with a linked feature guide.
- Moved monorepo maintainer details from the root README into
  `docs/development.md`, leaving the root README as a short entry point.
- Clarified that note-triage rationale belongs in a `docs/` explanation or
  architecture page, not only in the root README.
- Clarified that root `AGENTS.md` files must start with a brief project
  orientation and point to nested `AGENTS.md` files when directory-specific
  rules are created.
- Tightened sensitive-note handling so generated docs name sensitive categories
  such as customer names, emails, account IDs, private hosts, and tokens instead
  of carrying example values forward.

## v0.4.0 - 2026-06-25

- Moved primary usage examples into the skill package README and made the root
  README point to the package as the main product entry point.
- Reworded the project `AGENTS.md` template's skipped-check guidance to avoid
  duplicating the skill's canonical verification rule.
- Added an `AGENTS.md` review rubric and documentation audit workflow to the
  published skill references.
- Renamed reusable rule references from `agents-md.md` and `readme.md` to
  `agents-rules.md` and `readme-rules.md`.
- Tightened the skill trigger boundary around repository-level docs and agent
  workflow extraction.
- Clarified that root `AGENTS.md` should point to nested `AGENTS.md` files when
  directory-specific rules are added.
- Clarified that root `AGENTS.md` files should not duplicate nested
  directory-specific rule details.
- Clarified that ordinary human runbooks should move from README files into
  `docs/`, not into task-specific skills.
- Clarified that README command lists must not infer hidden harness commands
  such as `test:agent`.
- Clarified that agents should make no file changes when existing docs already
  satisfy the requested audit or repair task.
- Split context-placement explanation from the shorter documentation
  architecture rule set.
- Added a static skill artifact check for frontmatter, package metadata,
  relative links, README contents, stale paths, and OpenAI prompt metadata.
- Added E2E boundary scenarios for no-op review, nested `AGENTS.md` overrides,
  human runbooks that should not become skills, stale README commands, and
  sensitive notes redaction.

## v0.3.0 - 2026-06-24

- Added workspace packages for deterministic Markdown/link validation and
  Codex-assisted semantic duplicate review.
- Added `agent-doc-rules.config.json` as shared documentation validation
  configuration.
- Added skill guidance for using `docs:check` when repositories expose a
  documentation validation gate.
- Added an E2E scenario for documentation validation routing.
- Updated agent E2E snapshots to include model, reasoning effort, runner, CLI
  version, and `skills` CLI version metadata.

## v0.2.0 - 2026-06-24

- Changed the release artifact from vendored `rules/` and `templates/`
  snapshots to a standard Agent Skill under
  `packages/agent-doc-rules-skill/`.
- Moved reusable rules, README guidance, the README rubric, and starter
  templates into the installable skill directory.
- Made `packages/agent-doc-rules-skill` a private workspace package for local
  E2E dependencies.
- Moved each agent E2E scenario fixture project into its own pnpm workspace
  package.
- Switched workspace management from npm to pnpm so E2E projects can use
  `workspace:*` dependencies on the skill package.
- Moved the skill source into `packages/agent-doc-rules-skill` so repository
  products are separated from monorepo support files.
- Added a root `workspace:*` dependency on the skill and a local skill sync
  script for monorepo maintenance.
- Moved the shared agent E2E runner into `tools/` and added a fast local skill
  install smoke test.
- Updated E2E scenarios to install their workspace skill dependency with
  `npx skills add` before generating or repairing `AGENTS.md`.
- Added a project-scoped maintainer skill set for skill authoring, document
  coauthoring, Diataxis documentation, plain-English editing, and Markdown index
  maintenance.
- Use `skills-lock.json` as the source of truth for restoring external
  project-scoped maintainer skills.
- Added npm-sourced `docmd-writer` and `meta-skill` maintainer skills as
  `devDependencies` of the skill workspace package.
- Added a project skill sync wrapper that restores npm-sourced skill
  dependencies from the skill package's `node_modules` into root
  `.agents/skills/`.
- Documented the maintainer skill sync model and add/update procedure.
- Added plain-English documentation writing guidance to the published
  `agent-doc-rules` skill.
- Added attribution for documentation and skill-design principles used by the
  published skill.
- Added a package-level README and context-placement docs for the published
  skill.
- Refocused the root README on monorepo goals, projects, and maintainer
  workflow.
- Generalized the agent E2E harness to judge multi-file documentation changes.
- Added E2E scenarios for README splitting, context placement, agent skill
  extraction, plain-English README cleanup, and local language overrides.

## v0.1.6 - 2026-06-17

- Made static checks the default `npm test` release gate.
- Switched the prepared agent E2E harness to use the available Codex CLI by
  default.
- Kept the Ollama-compatible local model path as an explicit optional runner
  without adding container runtime complexity.

## v0.1.5 - 2026-06-17

- Replaced the static content check and advisory LLM review with an E2E agent
  test under `test/`.
- Added create and repair scenarios for importing the rules into temporary
  projects and judging generated `AGENTS.md` output with a local model.
- Updated README validation guidance around `npm test` and local Ollama models.

## v0.1.4 - 2026-06-17

- Added deterministic Markdown, link, and content validation scripts.
- Added optional local Ollama-based LLM review.
- Documented validation commands in the README.
- Added a small npm audit gate with explicit accepted dev-tooling advisories.

## v0.1.3 - 2026-06-17

- Removed all optional maintainer skill recommendations from the README.
- Updated README examples to reference the current release tag.

## v0.1.2 - 2026-06-17

- Removed Notion-specific skills from the maintainer skill recommendations.
- Updated README examples to reference the current release tag.

## v0.1.1 - 2026-06-17

- Expanded README with installation, update, publishing, and maintenance guidance.
- Added recommended public Codex skills for documentation-library maintainers.

## v0.1.0 - 2026-06-17

- Added initial documentation architecture rule.
- Added `AGENTS.md` maintenance rule.
- Added project and overlay templates.
- Documented snapshot-based consumption model.
