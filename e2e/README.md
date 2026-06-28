# E2E Workspaces

Each scenario contains a prepared project under `project/`. The suite supports
two runner types:

- Agent scenarios run an AI agent against a fixture project, then judge the
  generated files against `criteria.md`.
- Command scenarios run a deterministic command against a fixture project and
  check the exit code, output, and expected file state from `scenario.json`.

Agent scenario projects depend on the local `@agent-doc-rules/skill` workspace
with `workspace:*`. The runner installs that local skill into a temporary copy
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

Command scenarios use this smaller shape:

```text
e2e/<scenario>/
  project/
    package.json
    README.md
    agent-doc-rules.config.json
  scenario.json
  snapshot/
    stdout.txt
    stderr.txt
```

Command snapshots are optional. Add `stdoutSnapshot` or `stderrSnapshot` under
`expect` in `scenario.json` when the exact command output is part of the
behavior under test.

`prompt.md` is the short user instruction for the scenario. Keep it natural and
avoid spelling out the expected skill behavior. Put project facts in
`project/`, and put pass/fail expectations in `criteria.md`.

`project/` is copied into a temporary project during each test. In an agent
scenario, the agent returns the files it created or changed, the runner writes
them into the temporary project, and the full generated file set is judged
against `criteria.md`. A scenario may return an empty file list when the correct
behavior is no change.

The shared runner lives at `tools/run-agent-e2e-scenario.mjs`; each scenario
project calls it through its local `test:agent` script.

Command scenarios are discovered by `tools/run-command-e2e-all.mjs` when they
contain `scenario.json`. The shared runner
`tools/run-command-e2e-scenario.mjs` copies the fixture project, prepends the
repository `node_modules/.bin` directory to `PATH`, runs the configured command,
and checks the configured expectations and output snapshots. Run them with:

```bash
corepack pnpm run test:e2e-command
```

When a scenario fails, the runner leaves the temporary output directory in
place. Agent scenarios also write `failure-summary.json` at the output root.
Read that summary first, then inspect `project/` inside the same directory. Use
[E2E Failure Triage](../docs/e2e-failure-triage.md) and
[E2E Rule Matrix](../docs/e2e-rule-matrix.md) before changing rules or
criteria.

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
present and uses `medium` reasoning effort by default. The Codex subprocess
then runs with `--ephemeral`, `--ignore-rules`, read-only sandboxing, and a
temporary `CODEX_HOME` that contains only generated test config and copied
`auth.json` when one exists. This keeps maintainer-local Codex config and
home-directory `AGENTS.md` files out of scenario behavior.

Override the model and reasoning effort for a refresh with:

```bash
CODEX_MODEL=gpt-5.5 CODEX_REASONING_EFFORT=medium UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

To write comparison snapshots without replacing `snapshot/`, set
`AGENT_E2E_SNAPSHOT_DIR` to a directory name:

```bash
AGENT_E2E_SNAPSHOT_DIR=snapshot-gpt-5-5-medium UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Review the diff before committing refreshed snapshots.
