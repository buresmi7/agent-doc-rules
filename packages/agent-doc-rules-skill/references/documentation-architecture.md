# Documentation Architecture

Use this rule when adding or changing project docs, rules, templates, skills,
or agent instructions. This is the short agent rule set. For the fuller
placement model and examples, see
[Context Placement](../docs/context-placement.md).

## Core Rule

Each fact has one canonical home. Other files link to it.

If the same rule needs to appear in more than one place, keep the rule in the
lowest shared document and link to it from the others.

## Quick Roles

- `README.md`: human entry point and first useful commands.
- `docs/`: durable human explanations, how-to guides, references, and runbooks.
- `AGENTS.md`: always-loaded agent routing, invariants, and verification rules.
- Nested `AGENTS.md`: directory-specific overrides. Root files should link to
  them, not copy their details.
- `.agents/skills/<name>/`: repeated task-specific agent workflows.
- Skill `references/`: detail loaded after a skill triggers.
- Templates: reusable output material, not policy prose.

## Placement Rules

- Put stable facts near the thing they describe.
- Put repeated agent workflow behavior in a task-specific skill.
- Put cross-cutting policy in `rules/`.
- Put rationale for format or architecture choices in `docs/`, not in the root
  README. Prefer a dedicated explanation or architecture page such as
  `docs/architecture.md` or `docs/output-format.md`; do not make a schema,
  importer, command, or API reference the canonical home for rationale.
- When triaging notes, any fact framed as a reason, rationale, why, or trade-off
  should move to that explanation or architecture page. README may link to it,
  but should not be the only home.
- Put command reference in `references/`, not in always-loaded docs.
- Put setup, install, repair, and troubleshooting procedures in the nearest
  detailed doc or skill reference, not in always-loaded docs or the root README.
- Put README quality rules in `references/readme-rules.md`; do not copy them into
  project README files.
- Put "why this rule exists" near the canonical rule. Use a short decision note
  when the trade-off matters.
- Move detail out when an always-loaded section grows past roughly ten lines.
- Prefer links over copied text.

## Validation

After changing documentation links, run the consuming project's `docs:check` or
Markdown link check if one exists.

When no automated checker exists, manually verify local relative links in:

- `AGENTS.md`
- nested `AGENTS.md` files
- `rules/`
- `templates/`
- root documentation

After changing shared rules or agent instructions, review nearby docs for
semantic duplicates. Remove duplicated prose and leave links to the canonical
rule.
