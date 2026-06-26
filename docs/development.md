# Monorepo Development

Use this page for monorepo maintainer workflows, including dependency install,
project skill sync, validators, E2E fixtures, and release checks.

For install commands, usage examples, the feature guide, and product docs, use
the [main package README](../packages/agent-doc-rules-skill/README.md).

## Use This Repository When

- You maintain the published `agent-doc-rules` skill.
- You change reusable documentation rules, references, or starter templates.
- You work on the Markdown/link validator or semantic duplicate checker.
- You test documentation and agent-context behavior in E2E scenarios.
- You prepare a release of the skill package.

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

### Factual Documentation Review

Agents should reject documentation changes that project evidence does not
support. Factual review compares claims against user constraints, local
commands, manifests, source files, configs, tests, canonical docs, and official
external sources when needed.

If a requested edit conflicts with local evidence, the agent should not edit the
file. It should report the contradiction and name the evidence instead. The
canonical rule lives in
[factual-review.md](../packages/agent-doc-rules-skill/references/factual-review.md).
The focused E2E scenario is
[factual-change-rejection](../e2e/factual-change-rejection/criteria.md): it asks
the agent to add Node.js 24 to the README while `package.json` only supports
`>=20 <24`, so the expected output is no file changes and a clear warning.

### Documentation Validation Tools

The monorepo ships two optional CLIs:

- [docs-validator](../packages/docs-validator/) checks Markdown and local links.
- [docs-duplicates](../packages/docs-duplicates/) finds likely semantic
  duplicate documentation passages.

Run `corepack pnpm run docs:check` for the configured documentation checks.

### Project Cleanup Checklist

Open [docs/project-cleanup.md](project-cleanup.md) for the checklist that covers
documentation placement, command evidence, setup behavior, implementation
complexity, and test evidence across multi-file changes.

### E2E Scenarios

The [e2e/](../e2e/) workspace runs tests against prepared fixture projects with
either an AI agent or a command runner. Agent scenarios have a prompt, criteria,
fixture project, and snapshot. Command scenarios have a fixture project and
`scenario.json`.
See [e2e/README.md](../e2e/README.md) for runner configuration and snapshot
refresh rules.

Related references: `docs/e2e-failure-triage.md` for failed runs and
`docs/e2e-rule-matrix.md` for rule coverage.

### Rule Placement

Use `docs/rule-placement.md` when an E2E failure or code review finding raises
uncertainty about where to document or enforce a rule. It explains when to
change always-loaded `SKILL.md`, a loaded reference, maintainer docs, test
criteria, fixtures, or deterministic tooling.

### Maintainer Skill Sync

Maintainer skills are restored from `skills-lock.json` and the local skill
workspace with `corepack pnpm run skills:sync`. `docs/maintainer-skills.md`
explains how maintainers review and restore them.

## Common Tasks

| Task | Command |
| --- | --- |
| Install dependencies | `corepack pnpm install` |
| Sync local and project-scoped skills | `corepack pnpm run skills:sync` |
| Verify local skill installation wiring | `corepack pnpm run test:install` |
| Check published skill metadata and package links | `corepack pnpm run test:skill` |
| Run E2E runner utility tests | `corepack pnpm run test:e2e-tools` |
| Run deterministic prose wording checks | `corepack pnpm run docs:wording` |
| Run AI sentence-level style review | `corepack pnpm run docs:style` |
| Run static Markdown, link, and audit checks | `corepack pnpm test` |
| Run the explicit documentation validation gate | `corepack pnpm run docs:check` |
| Create a starter docs-tool config in a consuming project | `agent-doc-rules-docs init` |
| Run command E2E scenarios | `corepack pnpm run test:e2e-command` |
| Run agent E2E tests when a runner is configured | `corepack pnpm run test:agent` |
| Run the full release verification gate | `corepack pnpm run verify:release` |
| Refresh passing agent snapshots after intended behavior changes | `UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent` |

See [E2E Workspaces](../e2e/README.md) for runner configuration and snapshot
metadata.

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
| [`e2e/`](../e2e/) | Agent and command E2E scenarios for documentation and context placement behavior. |
| [`docs/e2e-failure-triage.md`](e2e-failure-triage.md) | Maintainer workflow for diagnosing failed agent E2E scenarios. |
| [`docs/e2e-rule-matrix.md`](e2e-rule-matrix.md) | Scenario-to-rule coverage map for the agent E2E suite. |
| [`docs/rule-placement.md`](rule-placement.md) | Rubric for deciding whether a behavior belongs in `SKILL.md`, references, docs, criteria, fixtures, or tooling. |
| [`docs/project-cleanup.md`](project-cleanup.md) | Maintainer checklist for making cleanup part of development. |
| [`tools/`](../tools/) | Monorepo support scripts and shared E2E runner. |
| [`docs/maintainer-skills.md`](maintainer-skills.md) | Maintainer skill sync model and update procedure. |

Root scripts, E2E projects, generated maintainer skills, and monorepo docs are
not part of the published skill artifact.

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
| [`CHANGELOG.md`](../CHANGELOG.md) | Released skill and template behavior changes. |

When docs conflict, use the document that is the canonical source for that
detail.
Keep the root README focused on repository purpose, the first command to run,
and where to start. Put long procedures in the linked docs.

## Release Checklist

Release tags use `vMAJOR.MINOR.PATCH`.

Before publishing, verify these items:

- Run `corepack pnpm run verify:release`.
- Run `corepack pnpm test`.
- Run `corepack pnpm run test:skill`.
- Run `corepack pnpm run docs:check` when documentation validation behavior
  changed.
- Run `corepack pnpm run test:install`.
- Check that `npx skills add . --list` discovers `agent-doc-rules`.
- Review external maintainer skills if
  `packages/agent-doc-rules-skill/package.json` or `skills-lock.json` changed.
- Update `CHANGELOG.md` for released skill or template behavior changes.
- Check that reusable skill content contains no secrets, private environment
  details, or unsupported project-specific rules.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule or template proposals.
