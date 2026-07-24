# Monorepo Development

Use this page when maintaining the monorepo. It covers dependency setup,
restoring project skills, validators, E2E fixtures, and releases.

For install commands, usage examples, the feature guide, and product docs, use
[packages/agent-doc-rules-skill/README.md](../packages/agent-doc-rules-skill/README.md).

## Use This Repository When

- You maintain the published `agent-doc-rules` skill.
- You change reusable documentation rules, references, or starter templates.
- You work on the Markdown/link validator or semantic duplicate checker.
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

The installable skill lives in
[packages/agent-doc-rules-skill/](../packages/agent-doc-rules-skill/). Its
[SKILL.md](../packages/agent-doc-rules-skill/SKILL.md) tells agents which
reference file to read, and its
[package README](../packages/agent-doc-rules-skill/README.md) covers install
and usage.

The public npm package is `@buresmi7/agent-doc-rules-skill`. Its bin installer
copies only the skill artifact into `.agents/skills/agent-doc-rules/`; it does
not copy E2E fixtures, monorepo support scripts, or maintainer-only files.

### Factual Documentation Review

Agents should reject documentation changes that lack supporting evidence.
Evidence can include user constraints, local commands, manifests, source files,
configs, tests, canonical docs, or official external sources.

If a requested edit conflicts with local evidence, the agent should not edit the
file. It should report the contradiction and name the evidence instead. The
canonical rule lives in
[factual-review.md](../packages/agent-doc-rules-skill/references/factual-review.md).
The E2E scenario for this rule is
[factual-change-rejection](../e2e/factual-change-rejection/scenario.json). It asks
the agent to add Node.js 24 to the README while `package.json` only supports
`>=20 <24`. The expected output is no file changes and a clear warning.

### Documentation Validation Tools

The monorepo ships two optional CLIs:

- [docs-validator](../packages/docs-validator/) is published as
  `@buresmi7/agent-doc-rules-docs-validator` and checks Markdown, wording,
  security patterns, and local links.
- [docs-duplicates](../packages/docs-duplicates/) is published as
  `@buresmi7/agent-doc-rules-docs-duplicates` and finds likely semantic
  duplicate documentation passages.

Run `corepack pnpm run docs:check` for the configured documentation checks.

### Project Cleanup Checklist

Open [docs/project-cleanup.md](project-cleanup.md) before finishing changes that
affect multiple files or behavior. The checklist covers documentation
placement, command evidence, setup changes, whether nearby code should be
simplified or split, and test evidence.

### E2E Scenarios

The [e2e/](../e2e/) workspace runs tests against prepared fixture projects with
either an AI agent or a command runner. Both use `scenario.json`: agent
scenarios define ordered prompts and named criteria, while command scenarios
define a command and deterministic expectations. Each scenario also has a
fixture project and may have snapshots.
See [e2e/README.md](../e2e/README.md) for runner configuration and snapshot
refresh rules.

Related references: `docs/e2e-failure-triage.md` for failed runs and
`docs/e2e-rule-matrix.md` for rule coverage.

### Rule Placement

Use `docs/rule-placement.md` when an E2E failure or code review finding raises
uncertainty about where to document or enforce a rule. It explains when to
change always-loaded `SKILL.md`, required skill references, maintainer docs,
test criteria, fixtures, or deterministic tooling.

### Maintainer Skill Sync

Maintainer skills are restored from `skills-lock.json` and the local skill
workspace with `corepack pnpm run skills:sync`. `docs/maintainer-skills.md`
explains how maintainers review and restore them.

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
| Run deterministic prose wording checks | `corepack pnpm run docs:wording` |
| Run deterministic documentation security checks | `corepack pnpm run docs:security` |
| Run AI sentence-level style review | `corepack pnpm run docs:style` |
| Run static Markdown, security, link, and audit checks | `corepack pnpm test` |
| Run the explicit documentation validation gate | `corepack pnpm run docs:check` |
| Create a starter docs-tool config in a consuming project | `agent-doc-rules-docs init` |
| Run command E2E scenarios | `corepack pnpm run test:e2e-command` |
| Run agent E2E tests when a runner is configured | `corepack pnpm run test:agent` |
| Run the full release verification gate | `corepack pnpm run verify:release` |
| Refresh passing agent snapshots after intended behavior changes | `UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent` |

See the [E2E workspace guide](../e2e/README.md) for runner configuration and
snapshot metadata.

## Repository Map

| Path | Purpose |
| --- | --- |
| [`packages/agent-doc-rules-skill/`](../packages/agent-doc-rules-skill/) | Published skill package and installable artifact. |
| [`packages/agent-doc-rules-skill/README.md`](../packages/agent-doc-rules-skill/README.md) | Human-facing product README for the skill. |
| [`packages/agent-doc-rules-skill/docs/`](../packages/agent-doc-rules-skill/docs/) | Product docs for the skill. |
| [`packages/agent-doc-rules-skill/docs/adoption.md`](../packages/agent-doc-rules-skill/docs/adoption.md) | Setup path for consuming repositories. |
| [`packages/agent-doc-rules-skill/docs/tool-map.md`](../packages/agent-doc-rules-skill/docs/tool-map.md) | Map from common tasks to skill references and CLIs. |
| [`packages/agent-doc-rules-skill/docs/config-reference.md`](../packages/agent-doc-rules-skill/docs/config-reference.md) | Configuration reference for documentation tooling. |
| [`packages/agent-doc-rules-skill/docs/recipes.md`](../packages/agent-doc-rules-skill/docs/recipes.md) | E2E-backed examples for common documentation repairs. |
| [`packages/agent-doc-rules-skill/references/`](../packages/agent-doc-rules-skill/references/) | Canonical reusable rules loaded by the skill. |
| [`packages/agent-doc-rules-skill/assets/templates/`](../packages/agent-doc-rules-skill/assets/templates/) | Starter templates shipped with the skill. |
| [`packages/docs-validator/`](../packages/docs-validator/) | Deterministic Markdown and link validation CLI. |
| [`packages/docs-duplicates/`](../packages/docs-duplicates/) | Codex-assisted semantic duplicate checker. |
| [`packages/agent-e2e-runner/`](../packages/agent-e2e-runner/) | Reusable CLI and library for agent and command E2E scenarios. |
| [`e2e/`](../e2e/) | Agent and command E2E scenarios for documentation and context placement behavior. |
| [`docs/e2e-failure-triage.md`](e2e-failure-triage.md) | Maintainer workflow for diagnosing failed agent E2E scenarios. |
| [`docs/e2e-rule-matrix.md`](e2e-rule-matrix.md) | Scenario-to-rule coverage map for the agent E2E suite. |
| [`docs/rule-placement.md`](rule-placement.md) | Rubric for deciding whether a behavior belongs in `SKILL.md`, references, docs, criteria, fixtures, or tooling. |
| [`docs/project-cleanup.md`](project-cleanup.md) | Maintainer checklist for making cleanup part of development. |
| [`docs/release-management.md`](release-management.md) | Legacy Release reconciliation and independent package release procedure. |
| [`docs/decisions/independent-package-versioning.md`](decisions/independent-package-versioning.md) | Decision to end lockstep package versions after `v0.11.0`. |
| [`.changeset/`](../.changeset/) | Checked-in package release intent and independent-version configuration. |
| [`release-packages.json`](../release-packages.json) | Public package directories, tag prefixes, and repository identity used by release checks. |
| [`tools/`](../tools/) | Monorepo support scripts and E2E wrappers for this repository. |
| [`docs/maintainer-skills.md`](maintainer-skills.md) | Maintainer skill sync model and update procedure. |

## Canonical Docs

| Document | Content |
| --- | --- |
| [`AGENTS.md`](../AGENTS.md) | Project-specific agent routing, invariants, and verification rules. |
| [`packages/agent-doc-rules-skill/SKILL.md`](../packages/agent-doc-rules-skill/SKILL.md) | Agent entry file that loads the right rule references. |
| [`packages/agent-doc-rules-skill/README.md`](../packages/agent-doc-rules-skill/README.md) | Install, examples, feature guide, and development notes for the skill. |
| [`packages/agent-doc-rules-skill/docs/context-placement.md`](../packages/agent-doc-rules-skill/docs/context-placement.md) | How to choose a durable home for each project fact. |
| [`packages/agent-doc-rules-skill/docs/adoption.md`](../packages/agent-doc-rules-skill/docs/adoption.md) | How consuming repositories install, verify, and update the skill. |
| [`packages/agent-doc-rules-skill/docs/config-reference.md`](../packages/agent-doc-rules-skill/docs/config-reference.md) | Supported `agent-doc-rules.config.json` keys. |
| [`packages/agent-doc-rules-skill/references/`](../packages/agent-doc-rules-skill/references/) | Source of truth for reusable README, `AGENTS.md`, writing, validation, and documentation architecture rules. |
| [`docs/e2e-failure-triage.md`](e2e-failure-triage.md) | How maintainers diagnose failed agent E2E scenarios. |
| [`docs/e2e-rule-matrix.md`](e2e-rule-matrix.md) | Which skill behavior each E2E scenario protects. |
| [`docs/rule-placement.md`](rule-placement.md) | Where new maintainer or skill behavior should be encoded. |
| [`docs/maintainer-skills.md`](maintainer-skills.md) | How project-scoped maintainer skills are declared, restored, reviewed, and locked. |
| [`docs/project-cleanup.md`](project-cleanup.md) | How maintainers fold cleanup into ordinary development. |
| [`docs/release-management.md`](release-management.md) | How maintainers reconcile legacy Releases and publish independent package versions. |
| [`docs/decisions/independent-package-versioning.md`](decisions/independent-package-versioning.md) | Why public packages stop using lockstep versions after `v0.11.0`. |
| [`release-packages.json`](../release-packages.json) | Which public package, directory, and tag identity each release tool uses. |
| [`CHANGELOG.md`](../CHANGELOG.md) | Repository and monorepo history; package histories live beside their manifests. |

When docs conflict, use the document that is the canonical source for that
detail.
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
