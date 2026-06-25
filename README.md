# Agent Doc Rules

`agent-doc-rules` is a reusable Agent Skill for keeping repository docs,
`AGENTS.md` files, and task-specific agent skills short, accurate, and easy to
maintain.

This repository develops, validates, tests, and releases that skill. The skill
is the product; the rest of the monorepo exists to maintain it before projects
install it.

**Main package:** [packages/agent-doc-rules-skill/](packages/agent-doc-rules-skill/)
contains install commands, usage examples, package contents, and product docs.

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

See [Agent E2E Workspaces](e2e/README.md) for runner configuration and snapshot
metadata.

## Repository Map

| Path | Purpose |
| --- | --- |
| [`packages/agent-doc-rules-skill/`](packages/agent-doc-rules-skill/) | Published skill package and installable artifact. |
| [`packages/agent-doc-rules-skill/README.md`](packages/agent-doc-rules-skill/README.md) | Human-facing product README for the skill. |
| [`packages/agent-doc-rules-skill/docs/`](packages/agent-doc-rules-skill/docs/) | Product docs for the skill. |
| [`packages/agent-doc-rules-skill/references/`](packages/agent-doc-rules-skill/references/) | Canonical reusable rules loaded by the skill. |
| [`packages/agent-doc-rules-skill/assets/templates/`](packages/agent-doc-rules-skill/assets/templates/) | Starter templates shipped with the skill. |
| [`packages/docs-validator/`](packages/docs-validator/) | Deterministic Markdown and link validation CLI. |
| [`packages/docs-duplicates/`](packages/docs-duplicates/) | Codex-assisted semantic duplicate checker. |
| [`e2e/`](e2e/) | Agent E2E scenarios for documentation and context placement behavior. |
| [`tools/`](tools/) | Monorepo support scripts and shared E2E runner. |
| [`docs/maintainer-skills.md`](docs/maintainer-skills.md) | Maintainer skill sync model and update procedure. |

Root scripts, E2E projects, generated maintainer skills, and monorepo docs are
not part of the published skill artifact.

## Canonical Docs

| Document | Content |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | Project-specific agent routing, invariants, and verification rules. |
| [`packages/agent-doc-rules-skill/SKILL.md`](packages/agent-doc-rules-skill/SKILL.md) | Skill entry point and routing workflow. |
| [`packages/agent-doc-rules-skill/README.md`](packages/agent-doc-rules-skill/README.md) | Install, examples, package contents, and development notes for the skill. |
| [`packages/agent-doc-rules-skill/docs/context-placement.md`](packages/agent-doc-rules-skill/docs/context-placement.md) | How to choose a durable home for each project fact. |
| [`packages/agent-doc-rules-skill/references/`](packages/agent-doc-rules-skill/references/) | Source of truth for reusable README, `AGENTS.md`, writing, validation, and documentation architecture rules. |
| [`docs/maintainer-skills.md`](docs/maintainer-skills.md) | How project-scoped maintainer skills are declared, restored, reviewed, and locked. |
| [`CHANGELOG.md`](CHANGELOG.md) | Released skill and template behavior changes. |

When docs conflict, prefer the narrowest canonical document for that detail.
Keep human orientation in this README and long procedures in the linked docs.

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
