# Agent Doc Rules Skill

`agent-doc-rules` is an Agent Skill for repository documentation and agent
context architecture.

Use it when a project needs to decide what belongs in human documentation, what
belongs in always-loaded agent instructions, and what should become a
task-specific skill for agents.

## What It Does

- Keeps `AGENTS.md` short, local, and useful for agent routing.
- Shapes `README.md` as a human entry point, not a full manual.
- Separates long-lived docs from task-specific agent workflows.
- Applies plain-English writing rules to repository documentation.
- Uses progressive disclosure so detailed rules live in references, not in the
  always-loaded skill entry point.

## Install

Install from a repository release:

```bash
npx skills add <owner>/<repo> --skill agent-doc-rules
```

Install a tagged skill directory:

```bash
npx skills add https://github.com/<owner>/<repo>/tree/<tag>/packages/agent-doc-rules-skill
```

Install the local working tree for development:

```bash
npx skills add ./packages/agent-doc-rules-skill --skill agent-doc-rules -a codex -y --copy
```

For project-scoped Codex installs, the skill is installed under
`.agents/skills/agent-doc-rules/` and recorded in `skills-lock.json`.

Install optional documentation validation tools:

```bash
pnpm add -D @agent-doc-rules/docs-validator @agent-doc-rules/docs-duplicates
```

Recommended scripts:

```json
{
  "scripts": {
    "docs:markdown": "agent-doc-rules-docs markdown",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicates": "agent-doc-rules-docs-duplicates check",
    "docs:check": "agent-doc-rules-docs check && agent-doc-rules-docs-duplicates check"
  }
}
```

## Usage

Ask the agent to use the skill by name.

Main examples:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

```text
Use $agent-doc-rules to review this README for stale commands and duplicated rules.
```

```text
Use $agent-doc-rules to decide whether this note belongs in README.md,
AGENTS.md, docs/, or a task-specific skill.
```

```text
Use $agent-doc-rules to add a project-specific documentation overlay.
```

Common tasks:

- create or repair `AGENTS.md`,
- write or review a README,
- decide whether information belongs in docs, `AGENTS.md`, or a skill,
- add a project-specific documentation overlay,
- review docs for plain English and duplicated rules.

## Package Contents

| Path | Purpose |
| --- | --- |
| `SKILL.md` | Skill entry point and routing workflow. |
| `references/agents-md.md` | Rules for `AGENTS.md`. |
| `references/readme.md` | Rules for README files. |
| `references/readme-rubric.md` | README review checklist. |
| `references/documentation-architecture.md` | Source-of-truth and placement rules. |
| `references/writing-style.md` | Plain-English documentation writing rules. |
| `references/validation.md` | Documentation validation and duplicate-check guidance. |
| `references/influences.md` | Attribution for borrowed principles. |
| `assets/templates/` | Starter `AGENTS.md` templates. |
| `docs/context-placement.md` | Human-facing guide to docs vs agent context. |

## Context Placement

Context placement decides the durable home for each project fact.

Use:

- `README.md` for human orientation and first useful commands,
- `docs/` for long-lived explanations, how-to guides, references, and runbooks,
- `AGENTS.md` for short always-loaded agent routing and local invariants,
- `.agents/skills/<name>/` for repeated task workflows that agents should load
  only when relevant,
- `references/` inside a skill for detailed rules loaded on demand,
- `assets/` inside a skill for templates and reusable output material.

See [Context Placement](docs/context-placement.md) for the full model.

## Influences

See [Influences And Attribution](references/influences.md) for attribution,
design influences, and duplicate-review provenance.

## Development

From the monorepo root:

```bash
corepack pnpm install
corepack pnpm run skills:sync
corepack pnpm run test:install
corepack pnpm test
```

Run agent E2E tests only when an agent runner is configured:

```bash
corepack pnpm run test:agent
```
