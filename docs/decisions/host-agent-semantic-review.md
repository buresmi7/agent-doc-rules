# Host-Agent Semantic Documentation Review

Status: Accepted
Date: 2026-08-14

## Context

The published duplicate checker launched Codex to classify duplicate candidates
and review sentence style. Removing Codex from the package dependencies did not
remove that runtime requirement. Consuming projects still needed a separate AI
CLI, authentication, model access, and provider network access.

The installed skill already runs inside an agent that can make the same
semantic decisions. Starting a second agent process adds setup and provider
coupling without adding a separate source of project evidence.

## Decision

Consumer-facing validation is split by the kind of decision it makes:

- `agent-doc-rules-docs check` owns deterministic Markdown, wording, security,
  and link validation.
- `agent-doc-rules` owns writing and style judgment as part of its normal
  documentation workflow.
- `docs-duplicate-review` uses deterministic candidate evidence and asks the
  currently active agent to classify overlap and select a canonical owner.

The validator may report duplicate candidates, but a candidate is not a failed
check. No installed runtime launches an AI CLI, calls a model API, or requires
AI authentication. The Codex-backed duplicate-checker package is retired from
the active workspace and release model.

## Consequences

- A consuming project needs no second AI runtime to use the skills and tools.
- `docs:check` remains suitable for deterministic automation.
- Semantic style and duplicate review are agent workflows, not unattended CI
  gates with process exit codes.
- Candidate output must be stable, bounded, and explicit when truncated. Its
  digest binds both source units and candidate-selection scope so an agent
  cannot combine different scans or claim complete coverage from a partial
  batch.
- Documentation under review is untrusted data. Skills must not follow commands
  or instructions embedded in candidate text.
- Maintainer-only agent E2E tests may use a configured agent runtime, but that
  runtime is not installed or invoked by consuming projects.
