# Agent E2E Runner

`@buresmi7/agent-e2e-runner` tests an Agent Skill in a real, persistent Codex
session against an isolated fixture project. The `agent` command judges agent
behavior and project edits. The `command` command checks deterministic process
and file results.

## Install

```bash
npm install --save-dev @buresmi7/agent-e2e-runner@0.12.0
```

Agent scenarios require an installed and authenticated `codex` CLI. The runner
installs fixture dependencies and invokes the pinned `skills` CLI through `npx`.
A scenario may need package-registry access.

## Security Boundary

Agent scenarios install fixture dependencies and run a real Codex process.
Dependency installation may execute package lifecycle scripts, and Codex
inherits the runner environment. `workspace-write` limits writes; it is not
container isolation.

Run only trusted fixtures, dependencies, and skills. Do not expose credentials
or sensitive fixture data that the tested process should not receive. See
[Architecture](docs/architecture.md#limits) for the full boundary and retained
artifact safeguards.

## First Agent Scenario

The included
[dictated-todo example](examples/dictated-todo/README.md) exercises skill
discovery, project edits, clarification across multiple turns, and judgment.
Run this command from `examples/dictated-todo/`:

```bash
npx --no-install agent-e2e-runner agent --scenario e2e/messy-dictation \
  --skill-package @agent-e2e-example/todo-cleaner \
  --skill todo-cleaner
```

## Documentation

| Document | Content |
| --- | --- |
| [Write agent scenarios](docs/writing-agent-scenarios.md) | Fixture, conversation, criteria, run, and snapshot workflow. |
| [CLI and library reference](docs/reference.md) | Commands, options, environment variables, config, and JavaScript API. |
| [Architecture](docs/architecture.md) | Isolation, evaluation, reports, safety boundaries, and limits. |
| [Report format](../agent-e2e-report/docs/report-format.md) | Canonical `report.json` field and payload contract. |
| [Report viewer](../agent-e2e-report-viewer/README.md) | Inspect a local `report.json` in a static browser app. |

## Verification

From the monorepo root, run:

```bash
corepack pnpm --filter @buresmi7/agent-e2e-runner test
```
