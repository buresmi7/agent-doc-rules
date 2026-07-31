# Agent Session Format

`agent-session` is this package's portable input format. It is not an industry
standard. It provides one stable document for conversation items, project
changes, scenario expectations, evaluation results, and annotations.

The JSON Schema is
[`schema/agent-session.v1.schema.json`](../schema/agent-session.v1.schema.json).
Readers must check both `format` and `schemaVersion`:

```json
{
  "format": "agent-session",
  "schemaVersion": "1.0",
  "session": {},
  "turns": [],
  "project": {
    "finalChanges": []
  },
  "evaluation": null,
  "annotations": []
}
```

## Document Model

The format follows a `session -> turns -> items` hierarchy:

- `session` identifies the source, title, status, and source-specific metadata.
- `turns` preserve conversation order.
- `items` preserve messages and agent activity within each turn.
- `projectChanges` records the project change observed after a turn.
- `expectations` attaches test criteria to the assistant item they assess.
- `project.finalChanges` records the final project difference.
- `evaluation` records an optional overall judgment or runtime error.
- `annotations` highlights or comments on exact text.

Item types are open so an adapter can preserve new agent activity without
changing the format. The viewer understands `user_message`,
`assistant_message`, `reasoning`, `command_execution`, `file_change`,
`mcp_tool_call`, `web_search`, and `error`. Unknown types remain in the
document and receive a generic activity label.

File changes may contain:

- `before` and `after` snapshots, as captured by the E2E runner;
- a unified `patch`, as supplied by a source such as Codex;
- only `path` and `status` when content was not captured.

Consumers must not assume that a session contains file content or command
output.

Session JSON and rendered HTML may contain prompts, responses, commands, local
paths, file content, and tool results supplied by the source. Treat both as
debugging data and redact them before sharing outside their original trust
boundary.

## Expectations

Each expectation belongs to one turn and points to an assistant item:

```json
{
  "id": "request.update-readme",
  "text": "README.md explains the new command.",
  "source": "scenario.json#/turns/0/criteria/update-readme",
  "status": "failed",
  "reason": "The command is missing.",
  "targetItemId": "request:assistant"
}
```

`status` is `passed`, `failed`, or `not-evaluated`. A scenario overlay added to
an imported session starts as `not-evaluated`. For a completed E2E judgment,
criteria named in `failedCriteria` are `failed`; the remaining criteria are
`passed`. A runtime error leaves all expectations as `not-evaluated`.

Scenario overlays match turns by order. The importer rejects a different turn
count or different user prompt instead of attaching expectations to the wrong
response.

## Annotations

Annotations use the shape and text selector names from the
[W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/).
The package supports `TextQuoteSelector` and `TextPositionSelector` for
rendered text:

```json
{
  "id": "missing-command",
  "type": "Annotation",
  "motivation": "assessing",
  "body": {
    "type": "TextualBody",
    "value": "This claim does not name the command.",
    "tone": "failure"
  },
  "target": {
    "source": "urn:agent-session:item:request%3Aassistant",
    "selector": {
      "type": "TextQuoteSelector",
      "exact": "Updated the documentation."
    }
  }
}
```

Use a quote selector when the text may move. Add `prefix` and `suffix` when the
same quote occurs more than once. Use a position selector when character
offsets are stable:

```json
{
  "type": "TextPositionSelector",
  "start": 8,
  "end": 21
}
```

Library code can create target identifiers with `sessionItemSource()` and
`sessionFileSource()`. A file target identifies its scope, path, and
`before`, `after`, or `patch` side. An annotation without a selector comments
on the whole target.

The E2E judge may return exact evidence quotes for a failed criterion. The
runner converts a quote into an `assessing` annotation only when it finds the
exact text in that turn's response or resulting text file. A missing or
paraphrased quote is not highlighted.

## Codex Adapters

The package accepts two documented Codex integration surfaces:

- `importCodexExecJsonl()` reads the event stream written by
  [`codex exec --json`](https://learn.chatgpt.com/docs/non-interactive-mode.md).
- `importCodexThread()` reads a thread object returned by Codex App Server,
  including the result of
  [`thread/read` with `includeTurns`](https://learn.chatgpt.com/docs/app-server.md).

The App Server adapter is the better fit for an existing saved thread because
it exposes the stored thread, turns, and items. The JSONL adapter is useful
when the event stream was captured while a command ran. Codex JSONL does not
always repeat the user prompt, so callers can supply prompts separately.

The package does not treat Codex's private rollout or history files as a stable
exchange format. Convert them through a documented Codex interface or a
version-specific adapter.

## CLI

Render a normalized session:

```bash
agent-session-viewer agent-session.json --output session.html
```

Normalize and render a captured Codex event stream:

```bash
agent-session-viewer events.jsonl \
  --format codex-exec \
  --prompt "Update the README." \
  --session-output agent-session.json
```

Render an App Server thread and add expectations from an E2E scenario:

```bash
agent-session-viewer thread.json \
  --format codex-thread \
  --scenario scenario.json \
  --output session.html
```

Use `--annotations annotations.json` to apply an annotation array. The HTML
output is self-contained; it does not need the source JSON after rendering.

## Compatibility

Version `1.x` may add optional item fields and new item types. A change that
removes a field, changes its meaning, or makes an optional field required needs
a new major `schemaVersion`. Source adapters may evolve with their upstream
APIs without changing the normalized document.
