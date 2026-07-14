# E2E Workspaces

Each scenario contains a prepared project under `project/`. The suite supports
two runner types:

- Agent scenarios run an AI agent against a fixture project, then judge the
  generated files against `criteria.md`.
- Command scenarios run a deterministic command against a fixture project and
  check the exit code, output, and expected file state from `scenario.json`.

Agent scenario projects depend on the local `@buresmi7/agent-doc-rules-skill`
workspace with `workspace:*`. The runner installs that local skill into a
temporary copy with `npx skills add`.

Single-turn agent scenarios use this shape:

```text
e2e/<scenario>/
  project/
    package.json
    README.md
  prompt.md
  criteria.md
  snapshot/
    turn-01/
      files/
        AGENTS.md
        README.md
        docs/
          ...
      prompt.md
      notes.txt
      generated-files.json
      turn.json
    turns.json
    generated-files.json
    judgment.json
    metadata.json
```

Multi-turn agent scenarios replace `prompt.md` with ordered user-turn files:

```text
e2e/<scenario>/
  project/
    package.json
    README.md
  turns/
    01-request.md
    02-confirm.md
  criteria.md
  snapshot/
    turn-01/
      prompt.md
      notes.txt
      generated-files.json
      turn.json
    turn-02/
      files/
        docs/
          ...
      prompt.md
      notes.txt
      generated-files.json
      turn.json
    generated-files.json
    turns.json
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

`prompt.md` or each `turns/*.md` file is a short user instruction. Follow the
[prompt guidance](../docs/rule-placement.md) so prompts read like ordinary user
requests. Put project facts in `project/`, and put pass/fail expectations in
`criteria.md`. Use either `prompt.md` or `turns/*.md`; the runner rejects
scenarios that contain both.

Codex agent scenarios install the project skill and rely on normal skill
discovery. Scenario prompts should not tell the model which skill to use.

`project/` is copied into a temporary project during each test. In an agent
scenario, the agent returns the files it created or changed, the runner writes
them into the temporary project, and the final generated file set is judged
against `criteria.md`. In a multi-turn scenario, each turn sees the current
project state plus a short history of earlier user turns, agent notes, and
changed file paths. A turn may return an empty file list when the correct
behavior is to ask for confirmation or make no change.

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

Each agent turn gets a numbered directory such as `snapshot/turn-01/` with that
turn's prompt, raw agent notes, and generated file list. When a turn creates or
changes files, the same directory also contains a `files/` tree. Turns with no
file changes record an empty `generated-files.json`; their empty `files/`
directory may exist after a local refresh, but Git does not preserve it. This
applies to single-turn scenarios too.

The top-level `generated-files.json` stores the final file list as structured
data, `turns.json` indexes every turn and its snapshot directory,
`judgment.json` stores the judge result, and `metadata.json` stores the runner,
agent model, reasoning effort, CLI version, and `skills` CLI version used for
the snapshot refresh.

Refresh snapshots from a passing run with:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

The root `test:agent` script runs scenario projects serially. Agent scenarios
start model-backed Codex or Ollama runs, so serial execution keeps the full
suite focused on scenario behavior instead of parallel runner noise.

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
