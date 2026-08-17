# Agent Skill E2E Scenarios

These scenarios run real Codex conversations against fixture projects to test
`@buresmi7/agent-doc-rules-skill`. The runner judges each response and project
state against the criteria in `scenario.json`.

Each fixture project declares the local skill package as a `workspace:*`
dependency. Its `test:agent` script selects that package and the skill under
test. The workspace install makes the dependency resolvable, and the runner
installs an isolated copy of the selected skill in each run directory.

## Scenario Layout

Each scenario uses this shape:

```text
<scenario>/
  project/
    package.json
    README.md
  scenario.json
  snapshot/
    report.json
```

The scenario config stores prompts and criteria in conversation order:

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

Keep each `prompt` short. Follow the
[rule-placement guidance](../../../docs/rule-placement.md) so prompts read like
ordinary user requests. Put project facts in `project/` and pass/fail
expectations in the same turn's `criteria` object. The runner rejects the
legacy `turns/`, `criteria/`, `prompt.md`, and `criteria.md` schemas.

Codex installs the project skill and relies on normal skill discovery.
`project/package.json` is the source of truth for the skill package and version.
Scenario turns should not tell the model which skill to use.

## Runner

The runner copies `project/` into an isolated directory. Codex reads and
changes that copy with its normal tools. The first turn starts a persistent
session, and later turns resume it with the prior responses and tool history.
The runner records the response and file diff after each turn.

The reusable runner package lives in
[`packages/agent-e2e-runner`](../../agent-e2e-runner/README.md).
[`agent-e2e.config.mjs`](agent-e2e.config.mjs) configures the skills CLI
version, judge prompt, snapshots, and triage links.
[`run-agent-scenario.mjs`](run-agent-scenario.mjs) passes repository and
scenario paths to the package CLI.

When a scenario fails, the runner keeps its run directory under
`<scenario>/.agent-e2e-output/`. It checkpoints `report.json` during setup and
before and after every conversation turn. Open that file in the
[static report viewer](../../agent-e2e-report-viewer/README.md), then inspect the
retained `project/` directory when you need the complete final files. Read
[E2E Failure Triage](../../../docs/e2e-failure-triage.md) and the
[E2E Rule Matrix](../../../docs/e2e-rule-matrix.md) before changing rules or
criteria.

## Snapshots

`snapshot/` contains output from a passing run. Wording can vary between models
and Codex versions, so the snapshot is an example rather than an exact golden
assertion. The criteria and judge decide whether a run passes.

Each scenario has one `snapshot/report.json`. It contains the prompts,
criteria, agent responses, concise tool activity, per-turn diffs, final diff,
judgment, and runner metadata. Retained runs use the same versioned
[report format](../../agent-e2e-report/docs/report-format.md).

Refresh snapshots from a passing run with:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

The root `test:agent` script runs up to two scenario projects at once. Projects,
Codex homes, and output directories are isolated per run. Package managers and
the skill installer may share their normal cache or store. Do not refresh the
same scenario snapshot concurrently.

Use workspace concurrency one in constrained CI environments or when the Codex
account hits rate limits:

```bash
corepack pnpm -r --workspace-concurrency=1 \
  --filter './packages/agent-doc-rules-skill/e2e/*/project' run test:agent
```

For Codex runs, the runner reads `model` from `$CODEX_HOME/config.toml` when
present and uses `medium` reasoning effort by default. The tested agent uses a
persistent `workspace-write` session. The separate judge is ephemeral and
read-only. Both use isolated `CODEX_HOME` directories with generated test
config and a copied `auth.json` when one exists. This keeps maintainer-local
Codex config and home-directory `AGENTS.md` files out of scenario behavior.

Override the model and reasoning effort for a refresh with:

```bash
CODEX_MODEL=gpt-5.5 CODEX_REASONING_EFFORT=medium \
  UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

To write comparison snapshots without replacing `snapshot/`, set
`AGENT_E2E_SNAPSHOT_DIR` to a directory name:

```bash
AGENT_E2E_SNAPSHOT_DIR=snapshot-gpt-5-5-medium \
  UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Review the diff before committing refreshed snapshots.
