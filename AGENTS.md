# Agent Doc Rules - AI Agent Instructions

This maintainer workspace builds the reusable `agent-doc-rules` skills and
documentation tools. Start with the [repository README](README.md). Keep the
repository generic; project-specific rules belong in consuming repositories.

## Shared Rules

Follow the installed
[AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
for shared instruction-file guidance.

## Skill Routing

- Use `$agent-doc-rules` for `AGENTS.md`, README, documentation architecture,
  factual or security review, templates, and documentation E2E scenarios.
- Use `$docs-duplicate-review` for semantic review of repeated durable rules or
  facts.
- Use `$skill-creator` when changing or evaluating the published skills.
- Use `$doc-coauthoring` for substantial design documents and `$documentation-writer`
  for Diataxis-style user documentation.
- Use `$docmd-writer` for Markdown prose and code-block conventions,
  `$meta-skill` for reusable skill design, `$plain-english` before finishing
  prose changes, and `$update-markdown-file-index` for generated Markdown
  indexes.
- Follow the [maintainer skill guide](docs/maintainer-skills.md) for generated
  project skills, source links, locking, and review.

## Source Of Truth

- Published skills: [main skill](packages/agent-doc-rules-skill/skills/agent-doc-rules/SKILL.md)
  and [duplicate review](packages/agent-doc-rules-skill/skills/docs-duplicate-review/SKILL.md).
- Product and maintainer docs: [skill package README](packages/agent-doc-rules-skill/README.md),
  [guides](packages/agent-doc-rules-skill/docs/),
  [canonical rules](packages/agent-doc-rules-skill/skills/agent-doc-rules/references/),
  [development](docs/development.md), [project cleanup](docs/project-cleanup.md),
  [release management](docs/release-management.md), and [rule placement](docs/rule-placement.md).
- E2E guidance: [failure triage](docs/e2e-failure-triage.md),
  [rule matrix](docs/e2e-rule-matrix.md), and
  [report format](packages/agent-e2e-report/docs/report-format.md).
- Release and dependency state: [release package identities](release-packages.json),
  [changesets](.changeset/), [project skill lock](skills-lock.json), and
  [pnpm lockfile](pnpm-lock.yaml).

## Local Rules

- Write reusable files in English, keep the repository generic, and do not add
  consuming-project workflows, cloud accounts, secrets, private hosts, or
  environment notes.
- Keep always-loaded files short. The root README links to the
  [skill package README](packages/agent-doc-rules-skill/README.md) and
  [development guide](docs/development.md).
- Preserve the npm-compatible skill package and pnpm workspace boundary. Follow
  the [development guide](docs/development.md) for workspace metadata and the
  [maintainer skill guide](docs/maintainer-skills.md) for project skills and
  [skills-lock.json](skills-lock.json).
- Keep E2E scenarios beside the package they test. Use
  [E2E failure triage](docs/e2e-failure-triage.md) and
  [rule placement](docs/rule-placement.md) before changing rules or criteria.
- Use the [project cleanup checklist](docs/project-cleanup.md) before finishing
  changes that affect more than one file or change repository behavior.

## Verification

Use the most specific route below. The release gate supersedes the other rows.

| Change scope | Required final checks |
| --- | --- |
| Documentation only | `corepack pnpm test` and `corepack pnpm run docs:check` |
| Skill layout or install behavior | `corepack pnpm run skills:sync`, `corepack pnpm run test:install`, and `corepack pnpm test`; add `docs:check` when documentation changed |
| Runtime, validator, or E2E code | The relevant targeted command from the [development guide](docs/development.md), then `corepack pnpm test` |
| Release preparation | `corepack pnpm run verify:release` |

If any required check is skipped, state the reason and the residual risk in the
final result.
