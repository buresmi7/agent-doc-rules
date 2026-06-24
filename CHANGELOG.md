# Changelog

## Unreleased

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
