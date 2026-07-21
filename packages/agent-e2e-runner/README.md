# Agent E2E Runner

`@buresmi7/agent-e2e-runner` tests an Agent Skill in a real, persistent Codex
session against a temporary fixture project. Codex discovers the installed
skill, reads and edits the project with its normal tools, and responds to each
user turn in the same conversation.

The package provides two commands:

- `agent` runs a Codex conversation and judges its behavior and project edits;
- `command` runs a deterministic command and checks its process and file
  results.

## Install

```bash
npm install --save-dev @buresmi7/agent-e2e-runner
```

Agent scenarios require an installed and authenticated `codex` CLI.
The runner installs fixture dependencies with the project's package manager.
It then runs the configured `skills` CLI through `npx`, so agent scenarios may
need npm registry access.

## How Agent Tests Work

For each agent scenario, the runner:

1. checks that `--skill-package` names a dependency in `project/package.json`;
2. copies `project/` to a temporary directory without `node_modules`;
3. installs the temporary project's dependencies;
4. installs an isolated copy of the selected skill with `skills add --copy`;
5. starts Codex with write access limited to that project;
6. sends every prompt in `scenario.json.turns` to the same Codex session;
7. records each agent response, completed tool activity, and the file changes
   from that turn;
8. asks a separate read-only Codex run to judge that evidence and the final
   project against the named criteria beside each prompt.

`--copy` is an isolation choice for the test, not a required Agent Skills
installation convention. The source fixture stays unchanged. A judged failure
keeps the temporary project, Codex event logs, transcript, and judgment. An
earlier setup or runtime error may have only the artifacts produced before the
error. See [Architecture](docs/architecture.md) for the test boundary and
limitations.

## Dictated Todo Example

The included `examples/dictated-todo/` scenario tests a small skill that turns
rough dictation into a useful todo list:

```text
examples/dictated-todo/
  skills/todo-cleaner/
    package.json
    SKILL.md
  e2e/messy-dictation/
    project/
      package.json
      docs/people.md
      docs/todo-style.md
      TODO.md
    scenario.json
```

The first turn is an ordinary dictated message, not a test instruction:

```text
Book the dentist for Thursday at four. The office printer is doing those pale
zebra stripes again, so order toner, not printer paper. Call Jane. Move the
launch email to Friday... no, make that Monday if legal still hasn't approved
it.
```

The existing todo already has a haircut at Thursday 4:00, and the project notes
list both Jane A. and Jane B. The skill should add the unambiguous toner task,
ask about the conflicts, and wait for later user turns before adding unresolved
work. A later `Buy flowers for Jane.` turn creates a second clarification loop.

Run the example from its directory:

```bash
npx agent-e2e-runner agent --scenario e2e/messy-dictation \
  --skill-package @agent-e2e-example/todo-cleaner \
  --skill todo-cleaner
```

This test covers behavior that a static review of `SKILL.md` cannot prove:
normal skill discovery, actual tool use, state preserved across turns,
clarification before edits, and the final repository state.

## Write Your Own Agent E2E Test

Keep each scenario focused on one behavior. Use multiple turns only when the
behavior depends on a real follow-up, such as clarification, confirmation, or a
changed decision.

### 1. Create the Fixture Project

Create a directory with the project state the agent should receive:

```text
e2e/readme-confirmation/
  project/
    package.json
    README.md
  scenario.json
```

The runner copies `project/` before each run, so the source fixture stays
unchanged. Put normal project facts and supported commands there. Do not add
test instructions or expected answers to fixture files.

Agent fixtures require `project/package.json`. Declare the runner and skill as
normal dependencies:

```json
{
  "name": "readme-confirmation-fixture",
  "version": "0.0.0",
  "private": true,
  "devDependencies": {
    "@acme/my-skill": "file:../../..",
    "@buresmi7/agent-e2e-runner": "^0.10.0"
  }
}
```

No runner-specific `package.json` field is required. The package manager owns
the skill source and version. Use `file:` for a local standalone package,
`workspace:*` in a workspace, or a published package version for a release
test. Local and workspace dependencies let each run use current uncommitted
skill changes.

### 2. Write the Conversation and Criteria

Add `scenario.json`. Keep each user prompt next to the behavior expected after
that turn:

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

Array order is conversation order. Each turn requires a unique kebab-case `id`,
a non-empty `prompt`, and at least one criterion. Criterion keys must also use
kebab-case, and their values must be non-empty strings. A one-turn test uses the
same shape with one array item. Criteria apply to the response, activity, and
project state immediately after their turn.

Write prompts as normal user messages. Do not tell the agent which skill to use
or describe the test. Write criteria against visible behavior and repository
state, not exact response wording or the skill's internal implementation.

### 3. Add a Test Script

Add the runner command to the fixture's `project/package.json`. Select the npm
package and the skill it contains explicitly:

```json
{
  "scripts": {
    "test:agent": "agent-e2e-runner agent --scenario .. --project . --skill-package @acme/my-skill --skill my-skill"
  }
}
```

`--skill-package` must match a package in `dependencies`, `devDependencies`, or
`optionalDependencies`. `--skill` must match the name in the selected skill's
`SKILL.md`. Keeping the selection in a standard npm script makes each fixture
self-contained without defining custom package metadata.

Use one script per scenario when your test runner or workspace should execute
scenarios independently or in parallel.

### 4. Run the Test

Install the fixture dependencies once so it can resolve the runner and local
skill package:

```bash
npm --prefix e2e/readme-confirmation/project install
```

Then run the scenario. The runner performs another clean dependency install in
the temporary copy on every run:

```bash
npm --prefix e2e/readme-confirmation/project run test:agent
```

A judged failure prints the failed criterion IDs and retains its inspection
artifacts. Setup and runtime errors print the available error context but may
occur before a transcript or judgment exists. To record a passing run:

```bash
UPDATE_AGENT_SNAPSHOTS=1 npm --prefix e2e/readme-confirmation/project run test:agent
```

Useful environment variables:

| Variable | Purpose |
| --- | --- |
| `CODEX_BIN` | Codex executable; defaults to `codex`. |
| `CODEX_MODEL` | Override the model used by the tested agent. |
| `CODEX_REASONING_EFFORT` | Override agent reasoning effort; defaults to `medium`. |
| `CODEX_JUDGE_MODEL` | Use a different Codex model for judging. |
| `CODEX_JUDGE_REASONING_EFFORT` | Override judge reasoning effort. |
| `UPDATE_AGENT_SNAPSHOTS=1` | Write snapshots for passing scenarios. |
| `AGENT_E2E_SNAPSHOT_DIR` | Write snapshots to a named directory. |
| `KEEP_TEST_OUTPUT=1` | Keep temporary output after a passing run. |

## Parallel Runs

One CLI invocation runs one scenario. Run independent invocations concurrently
through your test runner or workspace. Temporary projects, Codex homes, skill
installer caches, and output directories are isolated per scenario. Package
managers may share their normal cache or store. Keep the turns within one
scenario sequential, and start with a concurrency limit of two to avoid API
rate limits. For example, a pnpm workspace can use:

```bash
corepack pnpm -r --workspace-concurrency=2 run test:agent
```

## Agent Config

`agent-e2e.config.mjs` is optional. It configures suite-wide runner behavior,
not the skill under test. A `skill` entry in this file is rejected:

| Key | Purpose |
| --- | --- |
| `skillsCliVersion` | `skills` CLI version; defaults to `1.5.12`. |
| `judgePrompt` | Optional custom judge prompt template. |
| `passThreshold` | Minimum judge score; defaults to `0.8`. |
| `tempPrefix` | Prefix for temporary output directories. |
| `projectFileOptions` | Judge evidence selection and ignored paths. |
| `inspectLinks` | Extra paths written into failure summaries. |

Custom judge prompts may use:

- `{{criteria}}`
- `{{originalProjectFiles}}`
- `{{projectFiles}}`
- `{{changes}}`
- `{{transcript}}`

`{{transcript}}` provides the conversation, per-turn file changes, and a concise
tool audit. See [Architecture](docs/architecture.md#evaluation) for the exact
evidence boundary and retained debugging data.

`projectFileOptions` supports `evidenceFileNames`, `evidenceFileSuffixes`,
`evidenceFileExtensions`, `ignoredPaths`, `ignoredPathPrefixes`,
`ignoredDirectoryNames`, `hiddenPackageScripts`, `maxEvidenceFileBytes`, and
`maxEvidenceBytes`. Evidence limits fail with a clear error instead of silently
truncating judge context.

## Command Scenarios

Command scenarios copy a fixture, run one command, and check deterministic
expectations from `scenario.json`:

```json
{
  "command": "npm",
  "args": ["run", "docs:check"],
  "expect": {
    "exitCode": 0,
    "stdoutIncludes": ["docs ok"],
    "filesExist": ["README.md"]
  }
}
```

Run one with:

```bash
npx agent-e2e-runner command --scenario e2e/<scenario>
```

Supported expectations are `exitCode`, `stdoutIncludes`, `stderrIncludes`,
`stdoutExcludes`, `stderrExcludes`, `stdoutSnapshot`, `stderrSnapshot`,
`filesExist`, and `filesDoNotExist`.

## CLI Reference

```bash
agent-e2e-runner agent --scenario e2e/<name> --skill-package <package> --skill <name> [--config agent-e2e.config.mjs]
agent-e2e-runner command --scenario e2e/<name>
```

| Option | Scope | Purpose |
| --- | --- | --- |
| `--scenario <dir>` | Both | Scenario directory. |
| `--project <dir>` | Both | Fixture project; defaults to `<scenario>/project`. |
| `--repo-root <dir>` | Both | Repository root; defaults to the current directory. |
| `--keep-output` | Both | Keep temporary output after a passing run. |
| `--name <name>` | Both | Scenario name override. |
| `--help` | Both | Print CLI usage. |
| `--config <file>` | Agent | Config file; defaults to `agent-e2e.config.mjs`. |
| `--skill-package <package>` | Agent | Fixture dependency that contains the tested skill. |
| `--skill <name>` | Agent | Skill name passed to the skill installer. |
| `--snapshot-dir <name>` | Agent | Snapshot directory name. |
| `--update-snapshots` | Agent | Refresh snapshots for a passing run. |

## Library API

The CLI is the default integration. Projects that need custom discovery or
reporting can use the small public API:

```js
import { resolve } from 'node:path';
import {
  buildAgentRuntimeFromEnv,
  runAgentScenario,
  validateAgentRuntime
} from '@buresmi7/agent-e2e-runner';

const runtime = await buildAgentRuntimeFromEnv();
await validateAgentRuntime(runtime);

const result = await runAgentScenario({
  scenarioName: 'example',
  scenarioDir: resolve('e2e/example'),
  projectFixtureDir: resolve('e2e/example/project'),
  repoRoot: process.cwd(),
  runtime,
  skill: {
    packageName: '@acme/my-skill',
    name: 'my-skill'
  },
  skillsCliVersion: '1.5.12'
});
```

`runAgentScenario` verifies that `skill.packageName` is a fixture dependency
and uses its package spec as the source under test.

The root export also provides `createCodexSession`, `judgeAgentOutput`,
`readAgentMetadata`, `readSnapshotDirName`, `main`, `runCommand`, and
`runCommandScenario`.
