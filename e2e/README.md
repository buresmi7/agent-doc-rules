# Agent E2E Workspaces

Each scenario contains a standalone pnpm workspace project under `project/`.
The project depends on the local `@agent-doc-rules/skill` workspace with
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
    files/
      AGENTS.md
      README.md
      docs/
        ...
    generated-files.json
    judgment.json
    metadata.json
```

`prompt.md` is the short user instruction for the scenario. Keep it natural and
avoid spelling out the expected skill behavior. Put project facts in
`project/`, and put pass/fail expectations in `criteria.md`.

`project/` is copied into a temporary project during the test. The agent returns
the files it created or changed, the runner writes them into the temporary
project, and the full generated file set is judged against `criteria.md`.

The shared runner lives at `tools/run-agent-e2e-scenario.mjs`; each scenario
project calls it through its local `test:agent` script.

`snapshot/` contains example output from a passing run. It is not an exact
golden assertion because wording can vary between models and Codex versions.
The real pass/fail decision comes from the criteria and judge step.

Generated files are written under `snapshot/files/`. `generated-files.json`
stores the same file list as structured data, `judgment.json` stores the judge
result, and `metadata.json` stores the runner, agent model, reasoning effort,
CLI version, and `skills` CLI version used for the snapshot refresh.

Refresh snapshots from a passing run with:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

For Codex runs, the runner reads `model` from `$CODEX_HOME/config.toml` when
present and uses `medium` reasoning effort by default. Override them for a
refresh with:

```bash
CODEX_MODEL=gpt-5.5 CODEX_REASONING_EFFORT=medium UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

To write comparison snapshots without replacing `snapshot/`, set
`AGENT_E2E_SNAPSHOT_DIR` to a directory name:

```bash
AGENT_E2E_SNAPSHOT_DIR=snapshot-gpt-5-5-medium UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Review the diff before committing refreshed snapshots.
