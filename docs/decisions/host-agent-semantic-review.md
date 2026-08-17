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

## Trade-Off

Semantic findings no longer have a provider-independent process exit code.
Maintainers must invoke the relevant skill and review the current agent's
reasoning instead of treating style or duplicate ownership as an unattended CI
verdict. Deterministic automation can prove candidate coverage, but it cannot
prove that a semantic review occurred or that two agents would make the same
judgment.

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

## Applies To

- The [skill package documentation](../../packages/agent-doc-rules-skill/README.md),
  the `agent-doc-rules` writing workflow, and the
  [`docs-duplicate-review`](../../packages/agent-doc-rules-skill/skills/docs-duplicate-review/SKILL.md)
  workflow expose the host-agent review boundary.
- The [documentation validator](../../packages/docs-validator/README.md) emits
  deterministic findings and duplicate candidates without making semantic
  verdicts.
- The [consumer AI boundary](../../tools/consumer-ai-boundary.mjs) and its tests
  prevent consumer packages from reintroducing a secondary AI runtime.
- [Monorepo Development](../development.md) and
  [Release Management](../release-management.md) describe the active validator
  and retired-package boundaries.

## Backlinks

- [Monorepo Development](../development.md) links to this record from the
  documentation-validation tool map.
- [Release Management](../release-management.md) links to this record from the
  retired-package section.

## Revisit When

- Reconsider the boundary if consumers require semantic findings to block CI
  with reproducible process exit codes.
- Reconsider the workflow if the active agent cannot consume complete,
  deterministic candidate evidence without another runtime.
- Reopen this decision before adding an AI SDK, model API call, or secondary AI
  CLI to a consumer-facing package.
