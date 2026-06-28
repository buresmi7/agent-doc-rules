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
- Reviews repository docs for false, contradictory, unsupported, stale, or
  misleading claims.
- Reviews agent-facing docs for data leaks, prompt-injection language,
  validation bypasses, and backdoor-style guidance.
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
    "docs:wording": "agent-doc-rules-docs wording",
    "docs:security": "agent-doc-rules-docs security",
    "docs:style": "agent-doc-rules-docs-duplicates style",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicates": "agent-doc-rules-docs-duplicates check",
    "docs:check": "agent-doc-rules-docs check && agent-doc-rules-docs-duplicates style && agent-doc-rules-docs-duplicates check"
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
Use $agent-doc-rules to review these docs for factual accuracy, contradictions,
and unsupported claims.
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
- review agent-facing docs for security risks,
- review docs for factual accuracy, plain English, and duplicated rules.

## Adoption And Tools

- [Adoption Guide](docs/adoption.md) shows the smallest setup for consuming
  repositories.
- [Tool Map](docs/tool-map.md) maps common documentation tasks to the right
  skill reference or CLI.
- [Config Reference](docs/config-reference.md) documents
  `agent-doc-rules.config.json`.
- [Recipes](docs/recipes.md) gives before-and-after patterns based on the E2E
  scenarios.

## Feature Guide

- [Agent Instructions](#agent-instructions)
- [README Shaping](#readme-shaping)
- [Documentation Placement](#documentation-placement)
- [Documentation Repair](#documentation-repair)
- [Factual Documentation Review](#factual-documentation-review)
- [Documentation Security Review](#documentation-security-review)
- [Plain-English Cleanup](#plain-english-cleanup)
- [Validation Tools](#validation-tools)
- [Starter Templates](#starter-templates)
- [Adoption Docs](#adoption-docs)

### Agent Instructions

Create or repair `AGENTS.md` files so agents get a brief project orientation,
short routing rules, local constraints, nested instruction pointers, and
verification commands. The detailed rules live in
[`references/agents-rules.md`](references/agents-rules.md), with review checks
in [`references/agents-rubric.md`](references/agents-rubric.md).

### README Shaping

Keep README files useful as human entry points. The skill trims runbooks,
removes stale commands, and links to deeper docs instead of copying detail into
the README. See [`references/readme-rules.md`](references/readme-rules.md) and
[`references/readme-rubric.md`](references/readme-rubric.md).

### Documentation Placement

Decide whether a fact belongs in `README.md`, `docs/`, `AGENTS.md`, a skill,
or a skill reference. The compact rule set is
[`references/documentation-architecture.md`](references/documentation-architecture.md);
the fuller guide is [`docs/context-placement.md`](docs/context-placement.md).

### Documentation Repair

Move bloated, stale, duplicated, or inbox-style documentation into the right
canonical home. The audit workflow lives in
[`references/doc-audit.md`](references/doc-audit.md).

### Factual Documentation Review

Check documentation claims against project evidence before editing. If a
requested change conflicts with local manifests, source files, configs, tests,
or canonical docs, the skill tells the agent to report the conflict instead of
writing unsupported text. See
[`references/factual-review.md`](references/factual-review.md).

### Documentation Security Review

Review agent-facing docs as instructions that can influence future edits. The
security checklist covers data exfiltration, remote execution, credential
handling, prompt-injection language, validation bypasses, backdoor-style
guidance, remote tracking assets, and encoded payloads. See
[`references/security-review.md`](references/security-review.md).

### Plain-English Cleanup

Rewrite repository documentation in direct, specific language. The skill cuts
padding, avoids generic AI phrasing, and keeps the reader's task first. See
[`references/writing-style.md`](references/writing-style.md).

### Validation Tools

Use the optional CLIs to check Markdown, deterministic prose wording,
deterministic security patterns, AI sentence style, local links, and likely
duplicate documentation passages. Duplicate review supports
`docs.duplicates.ignorePairs` for narrow, documented overlaps such as E2E
criteria repeating the rule under test. The validation guidance lives in
[`references/validation.md`](references/validation.md).

### Starter Templates

Start new agent instruction files from the templates in
[`assets/templates/`](assets/templates/) instead of copying unrelated project
rules.

### Adoption Docs

Use the product docs when rolling the skill into another repository:

- [Adoption Guide](docs/adoption.md)
- [Tool Map](docs/tool-map.md)
- [Config Reference](docs/config-reference.md)
- [Recipes](docs/recipes.md)

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
