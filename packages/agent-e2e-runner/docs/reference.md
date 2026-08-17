# Agent E2E Runner Reference

This page documents the runner CLI, environment variables, configuration,
command scenarios, and JavaScript API. See
[Architecture](architecture.md) for isolation, evaluation, artifact lifecycle,
and limits.

## CLI

```bash
agent-e2e-runner agent --scenario e2e/<name> --skill-package <package> --skill <name> [--config agent-e2e.config.mjs]
agent-e2e-runner command --scenario e2e/<name>
```

| Option | Scope | Purpose |
| --- | --- | --- |
| `--scenario <dir>` | Both | Scenario directory. |
| `--project <dir>` | Both | Fixture project; defaults to `<scenario>/project`. |
| `--repo-root <dir>` | Both | Repository root; defaults to the current directory. |
| `--output-root <dir>` | Both | Parent directory for unique run output directories. |
| `--keep-output` | Both | Keep output after a passing run. |
| `--name <name>` | Both | Scenario name override. |
| `--help` | Both | Print CLI usage. |
| `--config <file>` | Agent | Config file; defaults to `agent-e2e.config.mjs`. |
| `--skill-package <package>` | Agent | Fixture dependency that contains the tested skill. |
| `--skill <name>` | Agent | Skill name passed to the skill installer. |
| `--snapshot-dir <name>` | Agent | Snapshot directory name. |
| `--update-snapshots` | Agent | Refresh the snapshot for a passing run. |

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CODEX_BIN` | `codex` | Codex executable. |
| `CODEX_MODEL` | Codex config or CLI default | Override the tested agent model. |
| `CODEX_REASONING_EFFORT` | `medium` | Override agent reasoning effort. |
| `CODEX_JUDGE_MODEL` | Agent model | Override the judge model. |
| `CODEX_JUDGE_REASONING_EFFORT` | Agent reasoning effort | Override judge reasoning effort. |
| `UPDATE_AGENT_SNAPSHOTS` | Off | Set to `1` to write a passing snapshot. |
| `AGENT_E2E_SNAPSHOT_DIR` | `snapshot` | Set the snapshot directory name. |
| `AGENT_E2E_OUTPUT_ROOT` | `<scenario>/.agent-e2e-output/` | Set the run output root. |
| `KEEP_TEST_OUTPUT` | Off | Set to `1` to keep output after a passing run. |

## Agent Config

`agent-e2e.config.mjs` is optional. It configures suite-wide runner behavior,
not the skill under test. A `skill` entry is rejected.

| Key | Purpose |
| --- | --- |
| `skillsCliVersion` | `skills` CLI version; defaults to `1.5.12`. |
| `judgePrompt` | Custom judge prompt template path. |
| `passThreshold` | Minimum judge score; defaults to `0.8`. |
| `tempPrefix` | Prefix for unique run directory names. |
| `projectFileOptions` | Judge evidence, ignored paths, and report diff limits. |
| `inspectLinks` | Extra repository-relative report paths; `project` is reserved. |

A custom judge prompt may use:

- `{{criteria}}`
- `{{originalProjectFiles}}`
- `{{projectFiles}}`
- `{{changes}}`
- `{{transcript}}`

Custom prompts must preserve the
[evaluation contract](architecture.md#evaluation).

`projectFileOptions` supports:

- `evidenceFileNames`, `evidenceFileSuffixes`, `evidenceFileExtensions`;
- `ignoredPaths`, `ignoredPathPrefixes`, `ignoredDirectoryNames`;
- `hiddenPackageScripts`;
- `maxEvidenceFileBytes`, `maxEvidenceBytes`, `maxProjectFiles`;
- `maxStateFileBytes`, `maxStateFiles`, `maxStateBytes`;
- `maxReportFileBytes`, `maxReportDiffBytes`, `maxReportChanges`, and
  `maxReportPatchBytes`.

The [report format defaults](../../agent-e2e-report/docs/report-format.md#default-limits)
define payload ceilings and overflow behavior.

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
npx --no-install agent-e2e-runner command --scenario e2e/<scenario>
```

Supported expectations are `exitCode`, `stdoutIncludes`, `stderrIncludes`,
`stdoutExcludes`, `stderrExcludes`, `stdoutSnapshot`, `stderrSnapshot`,
`filesExist`, and `filesDoNotExist`.

## Library API

The CLI is the default integration. Projects that need custom discovery or
reporting can use the public API:

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
and uses its package spec as the source under test. Pass `outputRoot` to place
run directories outside the scenario. Retained results include `reportPath`
for `report.json`; runtime errors expose the same path when a report exists.

The root export also provides `createCodexSession`, `judgeAgentOutput`,
`readAgentMetadata`, `readSnapshotDirName`, `main`, `runCommand`, and
`runCommandScenario`. Validate report documents with
[`@buresmi7/agent-e2e-report`](../../agent-e2e-report/README.md).
