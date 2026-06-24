# Context Placement

Use this guide when deciding where project information should live.

## Core Rule

Put each fact in the smallest durable home that serves the right reader.

If a fact is useful to humans, put it in human docs. If it changes agent
behavior on every task, put it in `AGENTS.md`. If it describes a repeatable
agent workflow, put it in a skill.

## Placement Matrix

| Home | Reader | Use For | Avoid |
| --- | --- | --- | --- |
| `README.md` | New human contributor | Project purpose, first useful action, canonical docs index, verified commands | Long runbooks, deep architecture, duplicated agent rules |
| `docs/` | Human maintainer | Architecture, how-to guides, reference, decisions, release notes, troubleshooting | Short routing rules that agents need on every task |
| `AGENTS.md` | Agent on every task | Local invariants, routing pointers, safety boundaries, verification commands | Long procedures, general documentation, copied reference text |
| `.agents/skills/<name>/` | Agent on matching task | Repeatable workflows, specialized judgment, bundled templates or scripts | One-off notes, facts humans need first, secrets |
| `references/` in a skill | Agent after skill triggers | Detailed rules, rubrics, examples, background | Always-needed instructions |
| `assets/` in a skill | Agent after skill triggers | Templates, examples, reusable output material | Policy prose that should be in references |

## README

Use `README.md` as the human entry point.

It should answer:

- what the project is,
- who should use it,
- where the source of truth lives,
- how to do the first useful action,
- how to verify common changes.

Move detail out when the README becomes a manual. Link to the nearest canonical
doc instead of copying content.

When creating more than one durable doc, add a compact canonical-docs section or
sentence in the README that links to each canonical doc the reader needs first.

Keep rationale, troubleshooting, release steps, and repair procedures out of the
README unless they are one-line pointers. Put the durable content in `docs/` and
link to it.

When triaging an inbox file such as `notes.md`, move every durable fact to its
new canonical home. Then remove the inbox file or replace it with a short pointer
that names those homes. Do not leave the original facts duplicated in the inbox.

## Docs

Use `docs/` for durable human-facing material.

Good `docs/` content includes:

- architecture decisions,
- rationale for format or architecture choices,
- setup details,
- release procedures,
- operational runbooks,
- troubleshooting, including fixture failures and repair steps,
- command and API reference,
- explanations of trade-offs.

Choose the document shape deliberately: tutorial, how-to, reference, or
explanation.

Keep explanation and repair content in `docs/` even when it starts as a short
note. A format rationale belongs in a dedicated explanation or architecture page
such as `docs/architecture.md` or `docs/output-format.md`, not as the main prose
inside a schema or API reference. Fixture-failure steps belong in a
troubleshooting or how-to page. `README.md` and reference docs may summarize and
link to those pages, but should not be their canonical home.

## AGENTS.md

Use `AGENTS.md` for always-loaded agent instructions.

Good `AGENTS.md` content includes:

- project orientation,
- local constraints,
- language rules,
- safety boundaries,
- links to canonical docs,
- verification commands agents should know before editing,
- links to troubleshooting docs when checks fail.

Keep it short. Put troubleshooting procedures in docs or skills and link to
them. If a required check cannot run, tell agents to state why and document the
remaining risk.

Do not place fixture-failure procedures directly in `AGENTS.md`; link to the
troubleshooting or how-to document instead. Include the verification command and
the skipped-check residual-risk rule as short bullets.

## Skills

Use a skill when a repeated agent task needs more than a static instruction.

Strong signals that information belongs in a skill:

- the text says the workflow is repeated,
- the workflow is meant for a coding agent or AI agent,
- the workflow has ordered steps, inputs, outputs, and review rules,
- the workflow needs bundled templates, references, or scripts.

A good skill contains:

- a clear trigger description,
- a short workflow,
- detailed references loaded only when needed,
- templates or scripts when they reduce repeated work.

When creating a skill from an existing README or doc, move the workflow into
`.agents/skills/<name>/SKILL.md` and leave only a short link from human docs or
`AGENTS.md`.

When a project gets a new local skill, create or update `AGENTS.md` so agents
can route to it from always-loaded context. Keep the `AGENTS.md` entry to one or
two bullets and link to the skill instead of copying the workflow.

Do not create a skill for facts that should be visible to humans first. Do not
create a skill for one-off project notes or ordinary human runbooks.

## Review Questions

Before adding information, ask:

- Who needs this first: a human, every agent task, or only one agent workflow?
- Will this fact stay true long enough to document?
- Is there already a canonical home for it?
- Would copying this text create two sources of truth?
- Does this need to be always loaded, or can it be loaded on demand?
