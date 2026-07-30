# Changelog

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
