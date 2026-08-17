# Adoption Guide

Use this guide to add the Agent Doc Rules skills to an existing repository.

The goal is a small setup:

- two installed skills,
- a concise `AGENTS.md`,
- optional documentation checks,
- a clear update path.

## Install The Skills

Install the published npm package from the repository root:

```bash
npx @buresmi7/agent-doc-rules-skill@1.0.1
```

The npm installer stages and then creates or updates these owned directories:

- `.agents/skills/agent-doc-rules/`
- `.agents/skills/docs-duplicate-review/`

It preserves unrelated skill directories. It copies only the public skill
artifacts, not this monorepo's E2E fixtures, support scripts, generated
maintainer skills, or root docs.

If installation fails, it attempts to restore both prior skill directories. An
incomplete restoration keeps its backups and reports the paths needed for
manual recovery.

Projects that use this direct installer should commit both copied skill
directories so fresh clones receive the same instructions. Projects that
restore skills during setup may instead record the pinned install command in
their existing setup workflow.

Use a tagged skill directory with the `skills` CLI when the consuming repository
wants a `skills-lock.json` entry:

```bash
npx -y skills@1.5.12 add https://github.com/<owner>/<repo>/tree/<tag>/packages/agent-doc-rules-skill --skill agent-doc-rules --skill docs-duplicate-review -y --copy
```

For local testing from this repository, install the working tree:

```bash
npx -y skills@1.5.12 add ./packages/agent-doc-rules-skill --skill agent-doc-rules --skill docs-duplicate-review -y --copy
```

The `skills add` path should create:

- `.agents/skills/agent-doc-rules/`
- `.agents/skills/docs-duplicate-review/`
- `skills-lock.json`

Commit `skills-lock.json`. Do not edit generated skill files by hand unless the
project intentionally vendors them.

## Add Or Repair AGENTS.md

Ask an agent to create or repair the root instructions:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

For a manual starting point, adapt
[`AGENTS.project.md`](../skills/agent-doc-rules/assets/templates/AGENTS.project.md).

A good root `AGENTS.md` should include:

- a short project orientation,
- links to installed shared rules,
- local source-of-truth docs,
- narrow project-specific constraints,
- verification commands.

## Add Documentation Checks

Install the deterministic validator when the project wants Markdown, wording,
security, local link checks, or duplicate review:

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-validator@1.0.1
```

Add scripts like these:

```json
{
  "scripts": {
    "docs:markdown": "agent-doc-rules-docs markdown",
    "docs:wording": "agent-doc-rules-docs wording",
    "docs:security": "agent-doc-rules-docs security",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicate-candidates": "agent-doc-rules-docs duplicate-candidates --format json",
    "docs:check": "agent-doc-rules-docs check"
  }
}
```

For starter config generation, use the validator's `init` command. See the
[Config Reference](../skills/agent-doc-rules/references/config-reference.md)
for supported keys.

The agent already working in the repository applies plain-English guidance
from `$agent-doc-rules`. For semantic overlap, `$docs-duplicate-review` uses
`docs:duplicate-candidates` as evidence and inspects the surrounding sections
before deciding `fail`, `warn`, or `ok`. The validator is optional for other
skill workflows, but duplicate review is incomplete without its candidate
command. Neither review needs another AI tool.

## Replace The Retired Duplicate Checker

Projects upgrading from a pre-1.0 setup should remove the retired package after
installing the current skills and validator:

```bash
pnpm remove @buresmi7/agent-doc-rules-docs-duplicates
```

If the project installed `@openai/codex` only as that checker's local fallback,
remove the unused dependency too:

```bash
pnpm remove @openai/codex
```

Keep it when another project workflow still owns that dependency.

Then replace `docs:style` and `docs:duplicates` scripts with
`docs:duplicate-candidates`, and keep `docs:check` as
`agent-doc-rules-docs check`. Move deterministic duplicate settings from
`docs.duplicates` to `docs.duplicateCandidates`. The retired checker selected
candidates at `Math.min(warnScore, 0.72)`, so set `minSimilarity` to that
effective value instead of copying `warnScore` directly. Its default
`warnScore` of `0.78` maps to `minSimilarity: 0.72`. Remove `failScore`,
`model`, `reasoningEffort`, and `codexBin`. Remove `docs.style`;
`$agent-doc-rules` now owns style judgment.

Use the
[Config Reference](../skills/agent-doc-rules/references/config-reference.md)
for the supported schema. Run `docs:check` and one complete
`$docs-duplicate-review` after the migration.

## Verify The Setup

Run the checks that exist in the consuming repository. A common path is:

```bash
pnpm run docs:check
```

If the repository does not install the optional tools, ask the agent to name the
nearest available Markdown, link, or documentation check before finishing docs
changes.

## Update The Skill

Use the same install command with a reviewed package version or tag when the
project wants to update both skills. This package version uses:

```bash
npx @buresmi7/agent-doc-rules-skill@1.0.1 --force
```

Review the generated diff before committing. If the project uses
`skills-lock.json`, review the lockfile change as well.

For repositories that use `skills-lock.json`, treat lockfile changes as a review
point. The lockfile should change only when the project accepts the new skill
content.

## Distribution Boundary

The published package contains:

- `README.md`
- `bin/`
- `docs/`
- `skills/agent-doc-rules/`
- `skills/docs-duplicate-review/`

The installer copies only the two skill directories. The package-level `docs/`
remain human-facing npm documentation. The package does not include this
monorepo's root maintainer docs, E2E fixtures, support scripts, or generated
project-scoped maintainer skills.
