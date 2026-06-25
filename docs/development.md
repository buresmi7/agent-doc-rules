# Monorepo Development

Use this page for monorepo maintainer workflows: dependency install, skill sync,
validators, E2E fixtures, and release checks.

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
[SKILL.md](../packages/agent-doc-rules-skill/SKILL.md) routes agent work to the
right reference file, and its
[package README](../packages/agent-doc-rules-skill/README.md) covers install
and usage.

### Factual Documentation Review

Factual review stops documentation changes that are not supported by project
evidence. The workflow compares claims against user constraints, local commands,
manifests, source files, configs, tests, canonical docs, and official external
sources when needed.

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

The recommended combined gate is `corepack pnpm run docs:check`.

### Agent E2E Scenarios

The [e2e/](../e2e/) workspace tests how the installed skill behaves in
temporary projects. Each scenario has a prompt, criteria, fixture project, and
snapshot. See [e2e/README.md](../e2e/README.md) for runner configuration and
snapshot refresh rules.

### Maintainer Skill Sync

Maintainer skills are restored from `skills-lock.json` and the local skill
workspace with `corepack pnpm run skills:sync`. The sync model is documented in
[maintainer-skills.md](maintainer-skills.md).

## Common Tasks

| Task | Command |
| --- | --- |
| Install dependencies | `corepack pnpm install` |
| Sync local and project-scoped skills | `corepack pnpm run skills:sync` |
| Verify local skill installation wiring | `corepack pnpm run test:install` |
| Check published skill metadata and package links | `corepack pnpm run test:skill` |
| Run static Markdown, link, and audit checks | `corepack pnpm test` |
| Run the explicit documentation validation gate | `corepack pnpm run docs:check` |
| Run agent E2E tests when a runner is configured | `corepack pnpm run test:agent` |
| Refresh passing agent snapshots after intended behavior changes | `UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent` |

See [Agent E2E Workspaces](../e2e/README.md) for runner configuration and
snapshot metadata.

## Repository Map

| Path | Purpose |
| --- | --- |
| [`packages/agent-doc-rules-skill/`](../packages/agent-doc-rules-skill/) | Published skill package and installable artifact. |
| [`packages/agent-doc-rules-skill/README.md`](../packages/agent-doc-rules-skill/README.md) | Human-facing product README for the skill. |
| [`packages/agent-doc-rules-skill/docs/`](../packages/agent-doc-rules-skill/docs/) | Product docs for the skill. |
| [`packages/agent-doc-rules-skill/references/`](../packages/agent-doc-rules-skill/references/) | Canonical reusable rules loaded by the skill. |
| [`packages/agent-doc-rules-skill/assets/templates/`](../packages/agent-doc-rules-skill/assets/templates/) | Starter templates shipped with the skill. |
| [`packages/docs-validator/`](../packages/docs-validator/) | Deterministic Markdown and link validation CLI. |
| [`packages/docs-duplicates/`](../packages/docs-duplicates/) | Codex-assisted semantic duplicate checker. |
| [`e2e/`](../e2e/) | Agent E2E scenarios for documentation and context placement behavior. |
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
| [`packages/agent-doc-rules-skill/references/`](../packages/agent-doc-rules-skill/references/) | Source of truth for reusable README, `AGENTS.md`, writing, validation, and documentation architecture rules. |
| [`docs/maintainer-skills.md`](maintainer-skills.md) | How project-scoped maintainer skills are declared, restored, reviewed, and locked. |
| [`CHANGELOG.md`](../CHANGELOG.md) | Released skill and template behavior changes. |

When docs conflict, prefer the narrowest canonical document for that detail.
Keep human orientation in the root README and long procedures in the linked
docs.

## Release Checklist

Release tags use `vMAJOR.MINOR.PATCH`.

Before publishing, verify:

- `corepack pnpm test` passes,
- `corepack pnpm run test:skill` passes,
- `corepack pnpm run docs:check` passes when documentation validation behavior
  changed,
- `corepack pnpm run test:install` passes,
- `npx skills add . --list` discovers `agent-doc-rules`,
- external maintainer skills have been reviewed if
  `packages/agent-doc-rules-skill/package.json` or `skills-lock.json` changed,
- `CHANGELOG.md` describes released skill or template behavior changes,
- reusable skill content passes the repository safety review.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule or template proposals.
