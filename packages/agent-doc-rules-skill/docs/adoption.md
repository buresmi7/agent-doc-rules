# Adoption Guide

Use this guide to add `agent-doc-rules` to an existing repository.

The goal is a small setup:

- one installed skill,
- a concise `AGENTS.md`,
- optional documentation checks,
- a clear update path.

## Install The Skill

Install a released skill directory:

```bash
npx skills add https://github.com/<owner>/<repo>/tree/<tag>/packages/agent-doc-rules-skill --skill agent-doc-rules -a codex -y --copy
```

For local testing from this repository, install the working tree:

```bash
npx skills add ./packages/agent-doc-rules-skill --skill agent-doc-rules -a codex -y --copy
```

The install should create:

- `.agents/skills/agent-doc-rules/`
- `skills-lock.json`

Commit `skills-lock.json`. Do not edit generated skill files by hand unless the
project intentionally vendors them.

## Add Or Repair AGENTS.md

Ask an agent to create or repair the root instructions:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

For a manual starting point, adapt
[`../assets/templates/AGENTS.project.md`](../assets/templates/AGENTS.project.md).

A good root `AGENTS.md` should include:

- a short project orientation,
- links to installed shared rules,
- local source-of-truth docs,
- narrow project-specific constraints,
- verification commands.

## Add Documentation Checks

Install the deterministic validator when the project wants Markdown and local
link checks:

```bash
pnpm add -D @agent-doc-rules/docs-validator
```

Install the duplicate checker when the project also wants semantic overlap
review:

```bash
pnpm add -D @agent-doc-rules/docs-duplicates
```

Add scripts like these:

```json
{
  "scripts": {
    "docs:markdown": "agent-doc-rules-docs markdown",
    "docs:wording": "agent-doc-rules-docs wording",
    "docs:style": "agent-doc-rules-docs-duplicates style",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicates": "agent-doc-rules-docs-duplicates check",
    "docs:check": "agent-doc-rules-docs check && agent-doc-rules-docs-duplicates style && agent-doc-rules-docs-duplicates check"
  }
}
```

For starter config generation, use the `init` command documented in
[docs-validator](../../docs-validator/README.md). See
[Config Reference](config-reference.md) for supported keys.

## Verify The Setup

Run the checks that exist in the consuming repository. A common path is:

```bash
pnpm run docs:check
```

If the repository does not install the optional tools, ask the agent to name the
nearest available Markdown, link, or documentation check before finishing docs
changes.

## Update The Skill

Use the same install command with a newer tag when the project wants to update
`agent-doc-rules`. Review the generated diff and lockfile change before
committing.

For repositories that use `skills-lock.json`, treat lockfile changes as a review
point. The lockfile should change only when the project accepts the new skill
content.

## Distribution Boundary

The published skill artifact contains:

- `SKILL.md`
- `README.md`
- `agents/`
- `assets/`
- `docs/`
- `references/`

It does not include this monorepo's root maintainer docs, E2E fixtures, support
scripts, or generated project-scoped maintainer skills.
