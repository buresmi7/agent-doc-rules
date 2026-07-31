# E2E Failure Triage

Use this workflow when `corepack pnpm run test:agent`,
`corepack pnpm run test:e2e-command`, or a targeted E2E scenario fails.

## First Read

Start with the runner output:

- `output:` points to the retained run directory.
- Agent scenarios also print `score`, failed criteria, `fix:` lines, and
  `summary:` after the runner sends generated output to the judge.
- Command scenarios print the command, actual exit code, failed expectations,
  stdout, and stderr.

For agent scenarios, open `failure-summary.json` first. It lists generated file
changes, the actual conversation, judge notes, failed criteria, turn summaries,
and the maintainer docs to use for triage. Then inspect `project/` inside the
same output directory to see the generated repository state. For command
scenarios, inspect `project/` and compare the runner output with `scenario.json`.

## Classify The Failure

Use `docs/e2e-rule-matrix.md` to identify the behavior the scenario tests. Use
`docs/rule-placement.md` to decide whether to change rules, docs, criteria,
fixtures, or tooling.

Common classifications:

- Missing always-loaded rule: the agent needed a short invariant before choosing
  a reference.
- Missing reference detail: the skill routed correctly, but the loaded rule did
  not explain the task well enough.
- Fixture evidence gap: the expected output depends on a fact not present in
  `project/`.
- Criteria ambiguity: the behavior is correct, but the judge lacks a crisp
  pass/fail statement.
- Turn leakage: a `scenario.json` prompt tells the agent too much about the
  expected implementation, such as naming the skill, target file, loaded
  reference, exact artifact to create, or mirroring criteria wording.
- Harness issue: Codex session resume, project diffing, snapshot handling, or
  judge input is wrong.

## Repair Loop

1. Fix the canonical rule, fixture, criterion, or tool surface. Do not loosen a
   criterion to hide a real behavior gap.
2. Run the targeted scenario:

   ```bash
   corepack pnpm --filter './e2e/<scenario>/project' run test:agent
   ```

   For command scenarios, run:

   ```bash
   SCENARIO_DIR=e2e/<scenario>/project node tools/run-command-e2e-scenario.mjs
   ```

3. If the scenario passed after a skill or reference change, run:

   ```bash
   corepack pnpm run skills:sync
   corepack pnpm run test:install
   ```

4. Run the broader gate for the changed surface:

   ```bash
   corepack pnpm test
   corepack pnpm run docs:check
   corepack pnpm run test:e2e-command
   corepack pnpm run test:agent
   ```

Failed output directories live under `<scenario>/.agent-e2e-output/` by
default. The runner ignores that directory for Git, but the files can still
contain fixture and conversation data. Delete retained runs when triage is
complete. They are debugging artifacts, not snapshots.

## Snapshot Updates

Only refresh snapshots after the scenario passes and the behavior change is
intentional:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Review snapshot diffs before committing. A snapshot records an example passing
run; the criteria remain the authority.
