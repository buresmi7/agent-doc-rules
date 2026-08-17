# Monorepo Development

Use this page when maintaining the monorepo. It covers dependency setup,
restoring project skills, validators, E2E fixtures, and releases.

For install commands, usage examples, the feature guide, and product docs, use
[packages/agent-doc-rules-skill/README.md](../packages/agent-doc-rules-skill/README.md).

## Use This Repository When

- You maintain the published `agent-doc-rules` skill.
- You change reusable documentation rules, references, or starter templates.
- You work on the deterministic documentation validator or duplicate candidate
  scanner.
- You test how agents read and apply documentation in E2E scenarios.
- You prepare a release of any public package.

## Quick Start

Run these commands from the repository root:

```bash
corepack pnpm install
corepack pnpm run skills:sync
corepack pnpm test
```

Use `corepack pnpm run docs:check` before finishing README, `AGENTS.md`, docs,
skill, reference, or template changes.

## Features

### Published Skill Package

The installable skill suite lives in
[packages/agent-doc-rules-skill/](../packages/agent-doc-rules-skill/). The
[main skill](../packages/agent-doc-rules-skill/skills/agent-doc-rules/SKILL.md)
routes documentation work, while
[duplicate review](../packages/agent-doc-rules-skill/skills/docs-duplicate-review/SKILL.md)
owns semantic duplicate classification. The
[package README](../packages/agent-doc-rules-skill/README.md) covers install
and usage.

The public npm package is `@buresmi7/agent-doc-rules-skill`. Its bin installer
copies the two owned skills into `.agents/skills/`; it does not copy E2E
fixtures, monorepo support scripts, or maintainer-only files.

### Factual Documentation Review

Agents should reject documentation changes that lack supporting evidence.
Evidence can include user constraints, local commands, manifests, source files,
configs, tests, canonical docs, or official external sources.

If a requested edit conflicts with local evidence, the agent should not edit the
file. It should report the contradiction and name the evidence instead. The
canonical rule lives in
[factual-review.md](../packages/agent-doc-rules-skill/skills/agent-doc-rules/references/factual-review.md).
The E2E scenario for this rule is
[factual-change-rejection](../packages/agent-doc-rules-skill/e2e/factual-change-rejection/scenario.json).
It asks the agent to add Node.js 24 to the README while `package.json` only
supports `>=20 <24`. The expected output is no file changes and a clear warning.

### Documentation Validation Tools

The monorepo ships one consumer-facing validation CLI:

- [docs-validator](../packages/docs-validator/) is published as
  `@buresmi7/agent-doc-rules-docs-validator`. It checks Markdown, wording,
  security patterns, and links, and emits deterministic duplicate candidates.

Style judgment stays in `agent-doc-rules`. The `docs-duplicate-review` skill
classifies candidate overlap with the currently active agent. The accepted
runtime boundary is recorded in
[Host-Agent Semantic Documentation Review](decisions/host-agent-semantic-review.md).

Run `corepack pnpm run docs:check` for the configured documentation checks and
the repository's self-compliance contracts.

### Project Cleanup Checklist

Open [docs/project-cleanup.md](project-cleanup.md) before finishing changes that
affect multiple files or behavior. The checklist covers documentation
placement, command evidence, setup changes, whether nearby code should be
simplified or split, and test evidence.

### E2E Scenarios

Each E2E suite lives beside the package whose behavior it tests. The
[skill E2E suite](../packages/agent-doc-rules-skill/e2e/README.md) runs AI-agent
scenarios with ordered prompts and named criteria. The
[validator E2E suite](../packages/docs-validator/e2e/README.md) runs
deterministic command scenarios. Both use prepared fixture projects and
`scenario.json` files.

Related references: [E2E failure triage](e2e-failure-triage.md) for failed runs
and the [E2E rule matrix](e2e-rule-matrix.md) for rule coverage.

### Rule Placement

Use [Rule Placement](rule-placement.md) when an E2E failure or code review finding raises
uncertainty about where to document or enforce a rule. It explains when to
change always-loaded `SKILL.md`, required skill references, maintainer docs,
test criteria, fixtures, or deterministic tooling.

### Maintainer Skill Sync

Maintainer skills are restored from `skills-lock.json` and the local skill
workspace with `corepack pnpm run skills:sync`. The
[maintainer skill guide](maintainer-skills.md) explains how maintainers review
and restore them.

### Release Management

Use [docs/release-management.md](release-management.md) to audit the reconciled
legacy tags and GitHub Releases and publish later package versions
independently. The accepted release model is recorded in
[Independent package versioning](decisions/independent-package-versioning.md).

## Common Tasks

| Task | Command |
| --- | --- |
| Install dependencies | `corepack pnpm install` |
| Sync local and project-scoped skills | `corepack pnpm run skills:sync` |
| Verify local skill installation wiring | `corepack pnpm run test:install` |
| Check published skill metadata and package links | `corepack pnpm run test:skill` |
| Check tool package metadata and pack output | `corepack pnpm run test:packages` |
| Run E2E runner utility tests | `corepack pnpm run test:e2e-tools` |
| Develop the report viewer | `corepack pnpm run dev:report-viewer` |
| Build the self-contained report viewer | `corepack pnpm run build:report-viewer` |
| Test and build the report viewer | `corepack pnpm run test:report-viewer` |
| Run deterministic prose wording checks | `corepack pnpm run docs:wording` |
| Run deterministic documentation security checks | `corepack pnpm run docs:security` |
| Collect deterministic duplicate candidates | `corepack pnpm run docs:duplicate-candidates` |
| Check repository documentation self-compliance | `corepack pnpm run test:self-compliance` |
| Run static Markdown, security, link, and audit checks | `corepack pnpm test` |
| Run the explicit documentation validation gate | `corepack pnpm run docs:check` |
| Preview the starter docs-tool config | `corepack pnpm exec agent-doc-rules-docs init --print` |
| Run command E2E scenarios | `corepack pnpm run test:e2e-command` |
| Run agent E2E tests when a runner is configured | `corepack pnpm run test:agent` |
| Run the full release verification gate | `corepack pnpm run verify:release` |
| Refresh passing agent snapshots after intended behavior changes | `UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent` |

See the [skill E2E guide](../packages/agent-doc-rules-skill/e2e/README.md) for
runner configuration and the single-file agent snapshot format.

## Repository Map

| Path | Purpose |
| --- | --- |
| [`packages/agent-doc-rules-skill/`](../packages/agent-doc-rules-skill/) | Published skills, product docs, reusable rules, templates, and agent E2E scenarios. |
| [`packages/docs-validator/`](../packages/docs-validator/) | Deterministic documentation CLI and command E2E scenarios. |
| [`packages/agent-e2e-runner/`](../packages/agent-e2e-runner/) | Agent and command E2E runner. |
| [`packages/agent-e2e-report/`](../packages/agent-e2e-report/) | Browser-safe `report.json` contract and validator. |
| [`packages/agent-e2e-report-viewer/`](../packages/agent-e2e-report-viewer/) | Private static report viewer. |
| [`tools/`](../tools/) | Monorepo support and release scripts. |
| [`.changeset/`](../.changeset/) and [`release-packages.json`](../release-packages.json) | Release intent and public package identities. |

## Maintainer Docs

| Document | Use it for |
| --- | --- |
| [`AGENTS.md`](../AGENTS.md) | Agent routing, local invariants, and verification rules. |
| [Skill package README](../packages/agent-doc-rules-skill/README.md) | Install, usage, and product documentation entry point. |
| [E2E failure triage](e2e-failure-triage.md) and [rule matrix](e2e-rule-matrix.md) | Diagnose scenarios and trace them to the rules they protect. |
| [Rule placement](rule-placement.md) | Choose whether behavior belongs in skills, references, docs, criteria, fixtures, or tooling. |
| [Maintainer skills](maintainer-skills.md) | Restore, review, and lock project-scoped skills. |
| [Project cleanup](project-cleanup.md) | Review non-trivial changes before final verification. |
| [Release management](release-management.md) | Prepare and publish independent package releases. |
| [Decisions](decisions/) | Understand accepted runtime and release trade-offs. |

When docs conflict, use the document that owns that subject.
Keep the root README focused on repository purpose, the first command to run,
the main package README, and the monorepo development guide. Put long
procedures in the linked docs.

## Release Checklist

Follow [Release Management](release-management.md) before changing versions,
tags, npm packages, or GitHub Releases. It owns release preparation, historical
reconciliation, package-specific publishing, verification, and failure
recovery.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule or template proposals.
