# Agent Doc Rules

Reusable Agent Skill for concise `AGENTS.md`, README, and repository
documentation rules.

`agent-doc-rules` packages reusable documentation guidance as a standard Agent
Skill. The repository is a small monorepo: source projects live under
`packages/`, monorepo tooling lives under `tools/`, and each E2E scenario is
its own workspace project that depends on the skill workspace.

## What Is Included

| Path | Purpose |
| --- | --- |
| `packages/agent-doc-rules-skill/SKILL.md` | Installable skill entry point. |
| `packages/agent-doc-rules-skill/package.json` | Private workspace package for local consumers. |
| `packages/agent-doc-rules-skill/references/` | Canonical reusable rules and rubrics. |
| `packages/agent-doc-rules-skill/assets/templates/` | Starter `AGENTS.md` overlay templates. |
| `e2e/create-basic/project/` | Workspace project for creating a new `AGENTS.md`. |
| `e2e/repair-bloated/project/` | Workspace project for repairing a bloated `AGENTS.md`. |
| `tools/` | Monorepo support scripts. |
| `scripts/check-audit.mjs` | Small pnpm audit gate for release checks. |

## Install

Install the skill from a released repository:

```bash
npx skills add <owner>/<repo> --skill agent-doc-rules
```

Install a specific tagged skill directory:

```bash
npx skills add https://github.com/<owner>/<repo>/tree/<tag>/packages/agent-doc-rules-skill
```

For local development, install the working tree into a temporary or test
project:

```bash
npx skills add ./packages/agent-doc-rules-skill --skill agent-doc-rules -a codex -y --copy
```

The `skills` CLI installs the skill into the target agent's native skill
directory, such as `.agents/skills/agent-doc-rules/` for project-scoped Codex
installations, and records the source in `skills-lock.json`.

## Usage

After installation, ask the agent to use the skill explicitly:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

The skill keeps always-loaded agent instructions short, links to canonical
references, and separates reusable guidance from local project overrides.

## Validation

Install dependencies with pnpm:

```bash
corepack pnpm install
```

Sync the local workspace skill into this monorepo's project-scoped agent skills:

```bash
corepack pnpm run skills:sync
```

Verify the local skill installation wiring without running agent E2E:

```bash
corepack pnpm run test:install
```

Run the static release checks:

```bash
corepack pnpm test
```

Static checks run Markdown linting, offline local link checks, and the pnpm audit
gate. The agent E2E harness is separate because it depends on an authenticated
agent or configured local model:

```bash
corepack pnpm run test:agent
```

Each E2E workspace depends on the local `@agent-doc-rules/skill` workspace
package with `workspace:*`. The runner resolves that dependency, copies the
scenario project to a temporary directory, installs the skill with `npx skills
add`, asks an agent to create or repair `AGENTS.md`, and judges the result
against scenario criteria.

Use `CODEX_MODEL` to pin the Codex model:

```bash
CODEX_MODEL=gpt-5-codex corepack pnpm run test:agent
```

Refresh passing scenario snapshots after an intentional prompt or criteria
change:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

An Ollama-compatible local runner remains available:

```bash
AGENT_TEST_RUNNER=ollama OLLAMA_MODEL=qwen2.5:3b corepack pnpm run test:agent
```

## Publishing

Release tags use `vMAJOR.MINOR.PATCH`. The installable artifact is the skill
directory under `packages/agent-doc-rules-skill/`; root scripts, `tools/`, and
E2E projects are maintenance infrastructure.

Before publishing, verify:

- `corepack pnpm test` passes,
- `corepack pnpm run test:install` passes,
- `npx skills add . --list` discovers `agent-doc-rules`,
- the changelog describes released skill or template behavior changes,
- no project-specific workflows, host names, account IDs, secrets, or private
  environment notes were added to reusable skill content.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule/template proposals.
