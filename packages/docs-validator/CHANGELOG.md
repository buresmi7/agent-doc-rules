# Changelog

## 1.0.1

### Patch Changes

- b1c084e: Replace copied validator configuration guidance with links to the canonical
  reference and document how validation exclusions preserve their remaining
  risk.

## 1.0.0

### Major Changes

- 3253966: Replace Codex-backed documentation review with host-agent skill workflows and
  deterministic duplicate candidate collection. The installed consumer runtime no
  longer requires an AI CLI, model configuration, or AI authentication.

## 0.11.2

### Patch Changes

- d1be9da: Keep each package's E2E scenarios, launchers, and test commands beside the
  behavior they cover while excluding fixtures and tests from published files.
- 59bdb3d: Store E2E run output under each scenario by default, with CLI and environment
  overrides for another output root. Keep the skill installer cache within the
  run directory and exclude generated run directories from documentation input.

## 0.11.1 - 2026-07-30

### Patch Changes

- Add GitHub repository, package homepage, and issue tracker links to the
  published package metadata.

## 0.11.0 - 2026-07-24

- Published the `0.10.0` validator unchanged in the final lockstep release.

## 0.10.0 - 2026-07-21

- Published the `0.9.0` validator unchanged as part of the lockstep release.

## 0.9.0 - 2026-07-14

- Published the `0.8.2` validator unchanged as part of the lockstep release.

## 0.8.2 - 2026-06-28

- Published the validator on npm for the first time under
  `@buresmi7/agent-doc-rules-docs-validator`.
- Shipped Markdown linting, local-link and fragment checks, deterministic
  wording review, documentation security checks, and configuration
  initialization in the public package.

## Pre-publication history

The validator first appeared on npm at `0.8.2`. The entries below record its
private `0.1.0` workspace history under `@agent-doc-rules/docs-validator`.

### Repository v0.7.0 - 2026-06-28

- Added deterministic security review for high-risk commands, secret
  disclosure, prompt injection, validation bypasses, backdoors, remote images,
  tracking links, and encoded payloads.
- Added security configuration, allow patterns, and the security step to the
  combined `check` command.

### Repository v0.6.0 - 2026-06-26

- Added `agent-doc-rules-docs init` to write or print starter configuration and
  package scripts.
- Added deterministic wording checks backed by `write-good`, including
  project-specific forbidden terms.

### Repository v0.3.0 - 2026-06-24

- Added the initial deterministic Markdown and local-link validation CLI.
- Added shared configuration, command parsing, and automated tests.
