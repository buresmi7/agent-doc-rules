# Agent E2E Scenarios

Each scenario keeps its user prompt, input fixture, judge criteria, and example
passing snapshot together.

```text
<scenario>/
  fixture/
  prompt.md
  criteria.md
  snapshot/
    AGENTS.md
    judgment.json
```

`prompt.md` is the short user instruction for the scenario. `fixture/` is
copied into a temporary project during the test. The generated `AGENTS.md` is
judged against `criteria.md`.

`snapshot/` contains an example output from a passing run. It is not an exact
golden assertion because wording can vary between models and Codex versions.
The real pass/fail decision comes from the criteria and judge step.

Refresh snapshots from a passing run with:

```bash
UPDATE_AGENT_SNAPSHOTS=1 npm run test:agent
```

Review the diff before committing refreshed snapshots.
