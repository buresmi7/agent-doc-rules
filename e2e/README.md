# Agent E2E Workspaces

Each scenario contains a standalone pnpm workspace project under `project/`. The
project depends on the local `@agent-doc-rules/skill` workspace with
`workspace:*`, then the runner installs that local skill into a temporary copy
with `npx skills add`.

```text
e2e/<scenario>/
  project/
    package.json
    README.md
  prompt.md
  criteria.md
  snapshot/
    AGENTS.md
    judgment.json
```

`prompt.md` is the short user instruction for the scenario. `project/` is
copied into a temporary project during the test. The generated `AGENTS.md` is
judged against `criteria.md`.

The shared runner lives at `tools/run-agent-e2e-scenario.mjs`; each scenario
project calls it through its local `test:agent` script.

`snapshot/` contains an example output from a passing run. It is not an exact
golden assertion because wording can vary between models and Codex versions.
The real pass/fail decision comes from the criteria and judge step.

Refresh snapshots from a passing run with:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Review the diff before committing refreshed snapshots.
