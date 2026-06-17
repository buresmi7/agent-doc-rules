# Changelog

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
