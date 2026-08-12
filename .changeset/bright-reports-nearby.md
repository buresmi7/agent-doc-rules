---
"@buresmi7/agent-e2e-report": minor
"@buresmi7/agent-e2e-runner": minor
---

Add a dependency-free, browser-safe package for the versioned `report.json`
contract and validator. Checkpoint that document throughout every agent
scenario with prompts, responses, expectations, tool summaries, per-turn
unified diffs, the final diff, and the judgment or runtime error. Store passing
agent snapshots as one `snapshot/report.json` file.

Replace `failure-summary.json`, the CLI `summary:` label, and the
`failureSummaryPath` result field with `report.json`, the CLI `report:` label,
and the `reportPath` result field. A private static viewer workspace consumes
the same public contract without adding browser dependencies to the runner.
