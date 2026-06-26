# Project Cleanup Checklist

Use this maintainer workflow before finishing non-trivial changes to the
`agent-doc-rules` monorepo.

This review makes cleanup part of development. It is not a separate rewrite
project, and it should not create churn in files that are already clear.

## When To Run It

Run this pass after changes that touch:

- `AGENTS.md`, README files, docs, templates, skill references, or E2E criteria,
- validation tools or their config,
- E2E runner behavior,
- release, install, or maintainer workflow docs.

For tiny typo fixes, run only the relevant local check.

## Checklist

1. Check the reader path.
   - New users should reach install, first use, config, and verification from
     the package README.
   - Maintainers should reach development, E2E triage, release, and skill sync
     docs from root docs.
2. Remove duplicate durable facts.
   - Keep each rule in one canonical file.
   - Replace copied rules with links.
3. Check complexity near the change.
   - Split files only when the split makes ownership clearer.
   - Prefer small modules for runner, CLI, config, and report formatting code.
4. Check command evidence.
   - README and docs commands must exist in local manifests or be labeled as
     examples.
   - Do not preserve stale commands because older docs mentioned them.
5. Check adoption friction.
   - A consuming project should know what to install, what to commit, and what
     to run after setup.
   - Optional tools should be clearly optional.
6. Check generated or external artifacts.
   - Use the boundary and review model in
     [`maintainer-skills.md`](maintainer-skills.md).
7. Run the narrowest useful checks, then the required gate.

## Verification

Use the same gates as the touched surface:

| Change | Minimum check |
| --- | --- |
| Docs, README, templates, or references | `corepack pnpm test` and `corepack pnpm run docs:check` |
| Skill layout or install behavior | `corepack pnpm run skills:sync`, `corepack pnpm run test:install`, and `corepack pnpm test` |
| Validation tools | package tests plus `corepack pnpm test` |
| E2E runner or criteria | targeted `test:agent` when a runner is configured, then full `corepack pnpm run test:agent` before release |
| Release preparation | `corepack pnpm run verify:release` |

If a check cannot run, record the reason and the remaining risk in the final
maintainer note.

## What Not To Do

- Do not rewrite compliant docs for style alone.
- Do not move facts away from their narrow canonical home.
- Do not add broad rules to `SKILL.md` when a loaded reference can carry the
  detail.
- Do not add new tools when a short doc or existing validator would solve the
  problem.
