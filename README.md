# Agent Doc Rules Monorepo

This monorepo develops and tests the reusable `agent-doc-rules` Agent Skill.

The skill is the product. Everything else in this repository exists to maintain,
validate, and test that skill before it is installed in other projects.

## Goals

- Publish one reusable Agent Skill for repository documentation and agent
  context architecture.
- Help projects decide what belongs in human docs, `AGENTS.md`, and
  task-specific agent skills.
- Keep documentation short, canonical, and written in plain English.
- Test the skill against realistic documentation and agent-context scenarios.
- Keep monorepo maintenance tooling separate from the installable skill
  artifact.

## Projects

| Path | Purpose |
| --- | --- |
| [`packages/agent-doc-rules-skill/`](packages/agent-doc-rules-skill/) | Published skill package. Start here for install and usage docs. |
| [`packages/agent-doc-rules-skill/README.md`](packages/agent-doc-rules-skill/README.md) | Human-facing documentation for the skill itself. |
| [`packages/agent-doc-rules-skill/docs/`](packages/agent-doc-rules-skill/docs/) | Product docs for the skill. |
| [`e2e/`](e2e/) | Agent E2E scenarios for documentation and context placement behavior. |
| [`tools/`](tools/) | Monorepo support scripts and shared E2E runner. |
| [`docs/maintainer-skills.md`](docs/maintainer-skills.md) | Maintainer skill sync model and update procedure. |

## Skill Package

Use the package README for product-level documentation:

- [Install the skill](packages/agent-doc-rules-skill/README.md#install)
- [Use the skill](packages/agent-doc-rules-skill/README.md#usage)
- [Understand the context placement model](packages/agent-doc-rules-skill/docs/context-placement.md)
- [Review influences and attribution](packages/agent-doc-rules-skill/references/influences.md)

The installable artifact is `packages/agent-doc-rules-skill/`. Root scripts,
E2E projects, generated maintainer skills, and monorepo docs are not part of
the published skill.

## Maintainer Workflow

Install dependencies:

```bash
corepack pnpm install
```

Sync the local skill and project-scoped maintainer skills:

```bash
corepack pnpm run skills:sync
```

Verify local skill wiring:

```bash
corepack pnpm run test:install
```

Run static checks:

```bash
corepack pnpm test
```

Run agent E2E tests when an agent runner is configured:

```bash
corepack pnpm run test:agent
```

The Codex runner reads `model` and `model_reasoning_effort` from
`$CODEX_HOME/config.toml` when they are present. Use environment variables to
pin them for a run:

```bash
CODEX_MODEL=gpt-5.5 CODEX_REASONING_EFFORT=xhigh corepack pnpm run test:agent
```

Refresh passing snapshots after intentional behavior changes:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Each refreshed snapshot writes `snapshot/metadata.json` with the agent model,
reasoning effort, runner, CLI version, and `skills` CLI version used for that
run.

## Maintainer Skills

This repository restores project-scoped maintainer skills under
`.agents/skills/`. They help maintain this monorepo; they are not part of the
published `agent-doc-rules` skill.

See [Maintainer Skill Sync](docs/maintainer-skills.md) for how those skills are
declared, restored, reviewed, and locked.

## Publishing

Release tags use `vMAJOR.MINOR.PATCH`.

Before publishing, verify:

- `corepack pnpm test` passes,
- `corepack pnpm run test:install` passes,
- `npx skills add . --list` discovers `agent-doc-rules`,
- external maintainer skills have been reviewed if
  `packages/agent-doc-rules-skill/package.json` or `skills-lock.json` changed,
- `CHANGELOG.md` describes released skill or template behavior changes,
- reusable skill content does not include project-specific workflows, host
  names, account IDs, secrets, or private environment notes.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule or template proposals.
