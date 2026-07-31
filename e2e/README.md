# E2E Workspaces

Each scenario contains a prepared project under `project/`. The suite supports
two runner types:

- Agent scenarios run a real Codex conversation against a fixture project, then
  judge each response and project state against its named criteria.
- Command scenarios run a deterministic command against a fixture project and
  check the exit code, output, and expected file state from `scenario.json`.

Each agent scenario project declares the local
`@buresmi7/agent-doc-rules-skill` dependency with `workspace:*`. Its standard
`test:agent` npm script selects the package and `agent-doc-rules` skill with CLI
flags. The workspace install makes that dependency resolvable. The runner
installs the project dependencies and an isolated copy of the skill inside the
temporary fixture.

Agent scenarios use this shape:

```text
e2e/<scenario>/
  project/
    package.json
    README.md
  scenario.json
  snapshot/
    turn-01/
      files/
        AGENTS.md
        README.md
        docs/
          ...
      request.txt
      response.txt
      activity.json
      changes.json
      turn.json
    turns.json
    changes.json
    judgment.json
    metadata.json
```

The config stores prompts and criteria in conversation order:

```json
{
  "turns": [
    {
      "id": "request",
      "prompt": "Can we use a temporary workaround?",
      "criteria": {
        "ask-first": "The response explains the trade-off and asks for confirmation."
      }
    },
    {
      "id": "confirm",
      "prompt": "Yes, accept the workaround.",
      "criteria": {
        "apply-change": "The confirmed narrow workaround is recorded."
      }
    }
  ]
}
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

Each `prompt` is a short user instruction. Follow
[rule-placement guidance](../docs/rule-placement.md) so prompts read like
ordinary user requests. Put project facts in `project/` and pass/fail
expectations in the same turn's `criteria` object. The runner rejects legacy
`turns/`, `criteria/`, `prompt.md`, and `criteria.md` agent schemas.

Codex agent scenarios install the project skill and rely on normal skill
discovery. `project/package.json` is the source of truth for the skill package
and version. Scenario turns should not tell the model which skill to use.

`project/` is copied into a temporary project during each test. Codex reads and
changes that copy with its normal tools. The first turn starts a persistent
session, and later turns resume the same session, including its real responses
and tool history. The runner records the response and file diff after each
turn; it does not construct file patches for the agent.

The reusable runner package lives in
`packages/agent-e2e-runner`. It exposes a standalone CLI and library API. The
root `agent-e2e.config.mjs` configures the skills CLI version, judge prompt,
snapshots, and triage links. `tools/run-agent-e2e-scenario.mjs` is a thin
adapter that passes repository and scenario paths to the package CLI.

Command scenarios are discovered by `tools/run-command-e2e-all.mjs` when their
`scenario.json` contains `command`. The `tools/run-command-e2e-scenario.mjs`
wrapper uses the package CLI through the same thin-adapter pattern. The package
copies the fixture project, prepends the repository `node_modules/.bin`
directory to `PATH`, runs the configured command, and checks the configured
expectations and output snapshots. Run them with:

```bash
corepack pnpm run test:e2e-command
```

When a scenario fails, the runner leaves the temporary output directory in
place. Agent scenarios also write `agent-session.json`,
`failure-report.html`, and `failure-summary.json` at the output root. Open the
HTML viewer first to compare each response and its expectations with the
project changes from that turn. Use the session JSON for the portable full
record or the summary for compact inspection, then inspect `project/` inside
the same directory when needed. Use
[E2E Failure Triage](../docs/e2e-failure-triage.md) and
[E2E Rule Matrix](../docs/e2e-rule-matrix.md) before changing rules or criteria.

`snapshot/` contains example output from a passing run. It is not an exact
golden assertion because wording can vary between models and Codex versions.
The real pass/fail decision comes from the criteria and judge step.

Each agent turn gets a numbered directory such as `snapshot/turn-01/` with that
turn's request, actual agent response, safe tool-activity summary, and file
changes. When a turn creates or changes files, the same directory also contains
a `files/` tree. Turns with no file changes record an empty `changes.json`;
their empty `files/` directory may exist after a local refresh, but Git does not
preserve it. This applies when the scenario has only one turn too.

The top-level `changes.json` stores the final file diff as structured data,
`turns.json` indexes every turn and its snapshot directory,
`judgment.json` stores the judge result, and `metadata.json` stores the runner,
agent model, reasoning effort, CLI version, and `skills` CLI version used for
the snapshot refresh.

Refresh snapshots from a passing run with:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

The root `test:agent` script runs up to two scenario projects concurrently.
Temporary projects, Codex homes, skill installer caches, and snapshot
directories are isolated per scenario. Package managers may share their normal
cache or store. Use workspace concurrency one in constrained CI environments
or when the Codex account hits rate limits:

```bash
corepack pnpm -r --workspace-concurrency=1 --filter './e2e/*/project' run test:agent
```

For Codex runs, the runner reads `model` from `$CODEX_HOME/config.toml` when
present and uses `medium` reasoning effort by default. The tested agent uses a
persistent `workspace-write` session. The separate judge is ephemeral and
read-only. Both use temporary `CODEX_HOME` directories that contain only
generated test config and copied `auth.json` when one exists. This keeps
maintainer-local Codex config and home-directory `AGENTS.md` files out of
scenario behavior.

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
