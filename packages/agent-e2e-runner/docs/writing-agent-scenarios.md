# Write Agent E2E Scenarios

Use an agent scenario when a behavior depends on a real Codex conversation,
skill discovery, tool use, or project edits. Use a deterministic
[command scenario](reference.md#command-scenarios) for exit codes, exact output,
and file checks.

Read the [security boundary](architecture.md#limits) before running third-party
fixtures, dependencies, or skills.

## Create The Fixture

Keep each scenario focused on one behavior. Use multiple turns only when the
behavior depends on a follow-up such as clarification, confirmation, or a
changed decision.

Create a scenario directory with the project state Codex should receive:

```text
e2e/readme-confirmation/
  project/
    package.json
    README.md
  scenario.json
```

Put normal project facts and supported commands in `project/`. Do not add test
instructions or expected answers to fixture files.

Agent fixtures require `project/package.json`. Declare the runner and skill as
normal dependencies:

```json
{
  "name": "readme-confirmation-fixture",
  "version": "0.0.0",
  "private": true,
  "devDependencies": {
    "@acme/my-skill": "file:../../..",
    "@buresmi7/agent-e2e-runner": "0.12.0"
  }
}
```

No runner-specific `package.json` field is required. Use `file:` for a local
standalone package, `workspace:*` in a workspace, or a published version for a
release test. Local and workspace dependencies let a run use current
uncommitted skill changes.

## Write The Conversation

Add `scenario.json`. Keep each prompt beside the criteria evaluated immediately
after that turn:

```json
{
  "turns": [
    {
      "id": "request",
      "prompt": "Add the npm test check to the README, but ask me before editing.",
      "criteria": {
        "ask-first": "The agent asks for confirmation and changes no files."
      }
    },
    {
      "id": "confirm",
      "prompt": "Yes, proceed.",
      "criteria": {
        "update-readme": "README.md tells contributors to run `npm test`."
      }
    }
  ]
}
```

Array order is conversation order. Each turn requires:

- a unique kebab-case `id` of at most 128 bytes;
- a non-empty `prompt`;
- at least one criterion with a unique kebab-case key of at most 128 bytes;
- a non-empty string for every criterion value.

A scenario may contain one to 16 turns. Write prompts as normal user messages;
do not name the skill or describe the test. Write criteria against visible
responses, activity, and repository state instead of exact wording or internal
implementation.

## Add The Test Script

Add the runner command to `project/package.json`. Select the npm package and the
skill it contains:

```json
{
  "scripts": {
    "test:agent": "agent-e2e-runner agent --scenario .. --project . --skill-package @acme/my-skill --skill my-skill"
  }
}
```

`--skill-package` must name a package in `dependencies`, `devDependencies`, or
`optionalDependencies`. `--skill` must match the name in that package's
`SKILL.md`.

Use one script per scenario when the workspace should run scenarios
independently or in parallel.

## Run The Scenario

Install the fixture dependencies once so the script can resolve the runner and
the selected skill:

```bash
npm --prefix e2e/readme-confirmation/project install
```

Then run the script:

```bash
npm --prefix e2e/readme-confirmation/project run test:agent
```

The runner installs dependencies again inside the isolated copy for every run.
See [Architecture](architecture.md#isolation) for package-manager selection and
the isolation boundary.

## Inspect And Record A Run

A failed run retains its available inspection artifacts. Open its `report.json`
in the [static report viewer](../../agent-e2e-report-viewer/README.md).
The [report format](../../agent-e2e-report/docs/report-format.md) owns the
document contract.

Record a passing run as `snapshot/report.json`:

```bash
UPDATE_AGENT_SNAPSHOTS=1 npm --prefix e2e/readme-confirmation/project run test:agent
```

See [Architecture](architecture.md#scenario-record-and-report) for how snapshots
relate to scenario criteria.

## Run Scenarios In Parallel

One CLI invocation runs one scenario. Start independent invocations through the
workspace or test runner. Keep turns within one scenario sequential. For
example, a pnpm workspace can use:

```bash
corepack pnpm -r --workspace-concurrency=2 run test:agent
```

Start with a concurrency limit of two to reduce API rate-limit pressure.
