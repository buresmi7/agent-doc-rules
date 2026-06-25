# Rule Placement Rubric

Use this maintainer rubric when an E2E failure, code review finding, or user
request raises a new behavior question for `agent-doc-rules`.

## Core Rule

Put the rule in the narrowest place that can make the next agent do the right
thing.

Do not teach behavior only through E2E criteria. Criteria prove behavior; they
are not the source of truth for agents.

## Placement

Use `packages/agent-doc-rules-skill/SKILL.md` when the rule must be available
before the agent chooses which reference to load. Good candidates are routing
rules, cross-scenario safety boundaries, no-invention rules, and short
invariants that prevent common harmful output.

Use `packages/agent-doc-rules-skill/references/` when the rule is task-specific
detail loaded after the skill triggers. Rubrics, report formats, evidence
checks, examples, and longer review workflows belong here.

Use `packages/agent-doc-rules-skill/docs/` for user-facing explanation about
the skill's model, trade-offs, and placement concepts.

Use root `AGENTS.md` for this repository's always-loaded maintainer rules:
verification commands, source-of-truth routing, release rules, and local
artifact boundaries.

Use root `docs/` for maintainer workflows, E2E triage, release procedure,
scenario coverage, and rationale that is not part of the published skill
artifact.

Use E2E `criteria.md` files for acceptance checks. Criteria may restate a rule
briefly, but they should link mentally to an actual rule surface. If a failure
shows missing behavior, update the rule first, then tighten the criterion only
when the judge needs a clearer pass/fail boundary.

Use E2E fixture `project/` files for project evidence. Fixtures should contain
the facts the agent may rely on. Do not hide expected behavior in fixture prose
unless a real consuming repository would say it that way.

Use E2E `prompt.md` files for natural user requests. Do not spell out the
expected implementation there unless the scenario is testing direct compliance
with a user instruction.

Use deterministic tooling when the failure is mechanical: broken links, missing
package metadata, stale paths, invalid Markdown, unsafe generated paths, or
required artifact structure.

## Triage Questions

- Does the agent need the rule before it knows which reference to read?
- Is this a reusable consuming-project behavior or only a maintainer workflow?
- Would putting this in `AGENTS.md` make every task carry unnecessary detail?
- Would putting this only in criteria leave future agents uninformed?
- Is the fixture missing evidence the desired output depends on?
- Can a deterministic check enforce the invariant more reliably than prose?

## Review Standard

After moving a rule, run the smallest failing E2E scenario first. Then run the
broader gate required by the touched surface:

- skill or reference changes: `corepack pnpm run skills:sync`,
  `corepack pnpm run test:install`, `corepack pnpm test`, and relevant agent
  E2E,
- docs-only maintainer changes: `corepack pnpm test` and
  `corepack pnpm run docs:check`,
- runner or scenario changes: targeted `test:agent` first, then the full
  `corepack pnpm run test:agent` when behavior could affect multiple scenarios.
