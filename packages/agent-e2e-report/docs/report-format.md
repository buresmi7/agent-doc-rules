# Agent E2E Report Format

`report.json` is the canonical record of one agent scenario run. Every run
starts checkpointing the document as soon as its output directory exists. The
runner then checkpoints it during setup, before and after each turn, after
evaluation, and when it handles an error. Completed turns therefore remain
available when a later turn fails. `snapshot/report.json` uses the same format
for a recorded passing example.

Errors that occur before the output directory exists cannot produce a report.
Examples include invalid CLI arguments and a config module that cannot be
loaded.

Consumers must check both identifiers before reading the rest of the document:

```json
{
  "format": "agent-e2e-report",
  "formatVersion": 1
}
```

Version 1 is a closed structure. The runner rejects unknown fields when it
writes a report. A consumer should reject an unsupported `format` or
`formatVersion` instead of guessing how to interpret it.

The dependency-free `@buresmi7/agent-e2e-report` package exports
`reportFormat`, `reportFormatVersion`, `maxReportDocumentBytes`, and
`validateScenarioReport()` for Node.js and browser consumers. File reading and
size enforcement stay with the caller.

## Top-Level Fields

| Field | Meaning |
| --- | --- |
| `revision` | Non-negative checkpoint revision. It increases during a retained run. A checked-in snapshot uses revision `1`. |
| `status` | `running`, `passed`, `failed`, or `error`. |
| `stage` | Lifecycle stage for the latest checkpoint, such as `scenario-definition`, `turn:<id>`, `judge`, or `complete`. |
| `scenario` | Scenario name and source file. |
| `runner`, `agent` | Runner name and bounded agent/model metadata. |
| `skillsCliVersion`, `skillPackage` | Installed skill tooling and package identity. |
| `passThreshold` | Required judge score from `0` to `1`; `null` only when invalid configuration is being reported. |
| `turns` | Every declared turn in scenario order, including turns that did not run. |
| `changes` | Diff between the initial installed fixture and the final captured project state. |
| `evaluation` | Judge result, or `null` before evaluation. |
| `error` | Runtime error name and first message line, or `null`. |
| `warnings` | Artifact or cleanup problems that did not replace the primary result. |
| `inspect` | Optional named inspection paths for retained runtime output. It is empty in portable snapshots. |

## Turns And Expectations

Each turn contains:

- `id`, `source`, and the normalized scenario `prompt` sent to the agent;
- `status`: `pending`, `running`, `completed`, or `incomplete`;
- the available agent `response`;
- every criterion with its content, result, and failure reason;
- concise tool `activity`;
- project `changes` made during that turn;
- a turn `error` when execution stopped before completion.

Turn IDs and criterion IDs are unique within the document. Failed criterion IDs
in an evaluation must also be unique, so one expectation cannot receive two
conflicting outcomes.

Criterion status is `not-evaluated`, `passed`, or `failed`. Criteria apply to
the whole turn: its response, tool activity, and resulting project state.
Before evaluation, every criterion is `not-evaluated`. After evaluation,
`failedCriteria` is exhaustive: listed criteria are `failed`, and every known
criterion omitted from the list is `passed`. The overall run can still fail
because its score is below the configured threshold.

Activity is deliberately bounded to summaries. Version 1 records command
summaries and exit codes, file-tool path summaries, MCP tool names, and web
search summaries. It does not embed raw command output or the complete Codex
event stream.

## Project Changes

A change has a project-relative `path`, a `status` of `created`, `modified`, or
`deleted`, metadata for the before and after versions, and either a unified
patch or an omission reason:

```json
{
  "path": "README.md",
  "status": "modified",
  "before": { "kind": "text", "byteLength": 9 },
  "after": { "kind": "text", "byteLength": 8 },
  "patch": {
    "format": "unified",
    "lines": [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1 +1 @@",
      "-# Before",
      "+# After"
    ]
  },
  "omission": null
}
```

File version `kind` is `text`, `binary`, or `omitted`. File content is not
duplicated outside the patch. When `patch` is `null`, `omission.reason` is one
of:

| Reason | Meaning |
| --- | --- |
| `binary` | A file version is not UTF-8 text. |
| `sensitive-path` | The path matches a common credential or private-key location. |
| `sensitive-content` | A file version contains a recognized private-key marker. |
| `empty-file` | A create or delete has no applicable unified-patch body. |
| `file-too-large` | A file version exceeds the per-file report limit. |
| `diff-too-large` | The unified patch exceeds the per-diff limit. |
| `report-budget` | Embedded patch text exhausted the run-wide patch budget. |

These omissions protect diff payloads only. Scenario prompts, agent responses,
criteria, evaluation text, and activity summaries are not redacted or
secret-scanned.

## Default Limits

| Data | Default | Behavior when exceeded |
| --- | --- | --- |
| `scenario.json` | 2 MiB | Fail before starting the agent. |
| One turn ID or criterion key | 128 bytes | Fail before starting the agent. |
| One normalized prompt or criterion | 256 KiB of encoded JSON | Fail before starting the agent. |
| Turns in one scenario | 16 | Fail before starting the agent. |
| Criteria for one turn | 256 | Fail before starting the agent. |
| File version included in a report diff | 256 KiB | Keep metadata and use `file-too-large`. |
| One unified patch | 512 KiB | Keep metadata and use `diff-too-large`. |
| Embedded patch text across the run | 8 MiB | Keep metadata and use `report-budget`. |
| Changes in one captured diff | 2,000 | Fail the run. |
| Agent response for one turn | 512 KiB of encoded JSON | Fail the run. |
| Activity for one turn | 512 KiB of encoded JSON | Fail the run. |
| Activity items for one turn | 1,024 top-level and nested file-change items | Fail the run. |
| Judge output | 2 MiB of encoded JSON | Fail the run. |
| Error name | 256 bytes of UTF-8 text | Truncate the name. |
| Error message | 32 KiB of UTF-8 text | Truncate the message. |
| One warning | 16 KiB of UTF-8 text | Truncate the warning. |
| Warnings | 64 entries | Keep a final omission warning. |
| Serialized `report.json` | 48 MiB | Reject the checkpoint and fail the run. |

The file-version, unified-patch, and run-wide patch-text limits omit payloads
without hiding that a file changed. The 2,000-change limit is fail-fast; it
does not omit extra changes. Response, activity, judge, and whole-document
limits also fail the run. If a failure prevents a new checkpoint, the
preceding atomically written `report.json` remains available. Runtime
checkpoints reserve 256 KiB of the document limit so a compact terminal error
can replace a near-limit running or passing state.

## Paths

- `scenario.source`, turn `source`, and criterion `source` are relative to the
  scenario directory. Turn and criterion sources include a JSON Pointer into
  `scenario.json`.
- Change paths and file-change activity paths are relative to the isolated
  fixture project.
- Agent response text may contain the placeholders `<project>` and
  `<test-output>` where the runner removed machine-specific absolute paths.
- In retained runtime output, `inspect.project` is reserved for the retained
  project and is relative to the directory containing `report.json`. Other
  configured `inspect` values must be repository-relative. Snapshots set
  `inspect` to an empty object because the copied report must not contain links
  to artifacts that are not copied with it.

## Evaluation And Errors

`evaluation` records the judge's boolean result, effective result after the
score threshold, score, failed and unknown criterion IDs, required fixes, and
notes. A non-empty failed-criteria list cannot produce an effective pass.

`error` represents a runner or agent runtime failure. Completed earlier turns
remain in the document, the active turn becomes `incomplete` when that state
can be checkpointed, and later turns stay `pending`. An evaluation may remain
present when a later runtime problem occurs. `warnings` preserve secondary
cleanup and artifact problems without hiding the primary evaluation or error.

## Snapshots

A passing snapshot is the same document at `snapshot/report.json`, with runtime
inspection links removed. The runner's
[architecture guide](../../agent-e2e-runner/docs/architecture.md#scenario-record-and-report)
defines how snapshot refresh writes and migrates this file.

## Viewer

The report viewer is a separate static application. It reads a local
`report.json` through the browser File API and validates this contract before
rendering it. The viewer neither uploads the report nor adds a second report
model. Its production build is one self-contained `index.html` that works from
local disk or a static host.
