# Agent E2E Report

`@buresmi7/agent-e2e-report` is a static session viewer and the report library
used by `@buresmi7/agent-e2e-runner`. It normalizes agent conversations into a
versioned `agent-session` JSON document and renders a self-contained HTML file.

The viewer can show:

- user and assistant messages in turn order;
- completed commands, file tools, MCP calls, and web searches;
- project changes after each turn and at the end of the session;
- the expectations attached to each assistant response;
- pass, failure, and runtime-error details;
- W3C-style text annotations and highlights.

It includes adapters for captured `codex exec --json` JSONL and Codex App
Server thread objects. See the [Agent Session Format](docs/session-format.md)
for the document model, annotation selectors, and import commands.

## Install

```bash
npm install --save-dev @buresmi7/agent-e2e-report
```

## CLI

Render an existing normalized session:

```bash
agent-session-viewer agent-session.json --output session.html
```

Import a Codex App Server thread and show criteria from a test scenario:

```bash
agent-session-viewer thread.json \
  --format codex-thread \
  --scenario scenario.json \
  --output session.html
```

Run `agent-session-viewer --help` for JSONL, prompt, annotation, and normalized
JSON output options.

## Library API

The main exports are:

- `createAgentSessionDocument()` and `validateAgentSessionDocument()`;
- `importCodexExecJsonl()` and `importCodexThread()`;
- `applyScenarioExpectations()` and `withSessionAnnotations()`;
- `renderSessionViewer()`;
- `writeFailureArtifacts()`, `buildFailureSummary()`, and
  `renderFailureReport()` for E2E runner integration.

An E2E failure writes `agent-session.json`, `failure-report.html`, and
`failure-summary.json`. Most test suites should call the E2E runner and inspect
those artifacts instead of using the report integration functions directly.
