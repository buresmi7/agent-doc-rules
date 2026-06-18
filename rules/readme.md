# README Rules

Use this rule when creating or maintaining a project `README.md`.

## Purpose

`README.md` is the human entry point for the repository. It should answer:

- what this project is,
- who it is for,
- where the source of truth lives,
- how to do the first useful action,
- how to verify changes.

It is not a full architecture document, runbook, changelog, or agent rule file.

## Core Rules

- Start with a concrete project title and a one-paragraph description.
- State the repository's role before listing commands or internals.
- Keep setup, usage, verification, and operational notes in separate sections.
- Put long procedures in the nearest detailed doc and link to them.
- Prefer tables for indexes, supported targets, commands, and canonical docs.
- Include commands only when they are known to work.
- Mark project status, limitations, and safety boundaries explicitly.
- Keep secrets, account IDs, host-specific values, and private environment notes
  out of the README.
- Remove placeholder sections instead of leaving empty boilerplate.
- Keep the README proportional to the project size.

## Recommended Shape

Use the smallest shape that fits the project:

```markdown
# Project Name

One short paragraph explaining what this repository is and why it exists.

## Source Of Truth

Links to canonical docs, specs, decisions, or external systems.

## Quick Start

The shortest verified path to a useful result.

## Usage

Common commands, workflows, or examples.

## Verification

Checks to run before publishing changes.

## Project Notes

Constraints, safety boundaries, status, or operational notes.
```

Do not include a section just because it appears in this shape.

## Source Of Truth

When the repository has multiple docs, add a compact index:

```markdown
## Canonical Docs

| Document | Content |
|---|---|
| `AGENTS.md` | Project-specific agent rules |
| `README.md` | Project overview and doc index |
| `docs/development.md` | Local setup and commands |
| `docs/architecture.md` | Architecture decisions and boundaries |
```

State which document wins when docs conflict. If another document is canonical
for a detail, link to it instead of copying its content.

## Commands

Command sections should be evidence-oriented:

- Use fenced code blocks for commands.
- Group commands by workflow.
- Say where commands run when that matters.
- Avoid commands that depend on private local state unless the README explains
  the prerequisite.
- If a command is intentionally illustrative, label it as an example.

## What To Avoid

- Marketing copy that does not help a contributor operate the project.
- Install or test commands that have not been verified.
- Full architecture explanations that belong in `docs/`.
- Duplicated rules from `AGENTS.md`, skills, or shared rule files.
- Long troubleshooting sections that belong in `references/` or runbooks.
- Placeholder badges, empty sections, and future-tense promises.

## Review

Use [`references/readme-rubric.md`](../references/readme-rubric.md) when
reviewing a README generated or edited by an agent.
