# E2E Failure Triage

Use this workflow when `corepack pnpm run test:agent` or a targeted E2E scenario
fails.

## First Read

Start with the runner output:

- `score` shows the judge's confidence.
- failed criteria name the acceptance rule that did not pass.
- `fix:` lines summarize the judge's requested repair.
- `output:` points to the temporary scenario output directory.
- `summary:` points to `failure-summary.json` when the runner reached the judge.

Open `failure-summary.json` first. It lists generated file paths, generator
notes, judge notes, failed criteria, and the maintainer docs to use for triage.
Then inspect `project/` inside the same output directory to see the generated
repository state.

## Classify The Failure

Use [E2E Rule Matrix](e2e-rule-matrix.md) to identify the behavior the scenario
protects, then choose the fix with [Rule Placement Rubric](rule-placement.md).

Common classifications:

- Missing always-loaded rule: the agent needed a short invariant before choosing
  a reference.
- Missing reference detail: the skill routed correctly, but the loaded rule did
  not explain the task well enough.
- Fixture evidence gap: the expected output depends on a fact not present in
  `project/`.
- Criteria ambiguity: the behavior is correct, but the judge lacks a crisp
  pass/fail statement.
- Prompt leakage: `prompt.md` tells the agent too much about the expected
  implementation.
- Harness issue: generated JSON, file normalization, snapshot handling, or judge
  input is wrong.

## Repair Loop

1. Fix the canonical rule, fixture, criterion, or tool surface. Do not loosen a
   criterion to hide a real behavior gap.
2. Run the targeted scenario:

   ```bash
   corepack pnpm --filter './e2e/<scenario>/project' run test:agent
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
   corepack pnpm run test:agent
   ```

Keep failed output directories out of commits. They are debugging artifacts, not
snapshots.

## Snapshot Updates

Only refresh snapshots after the scenario passes and the behavior change is
intentional:

```bash
UPDATE_AGENT_SNAPSHOTS=1 corepack pnpm run test:agent
```

Review snapshot diffs before committing. A snapshot records an example passing
run; the criteria remain the authority.
