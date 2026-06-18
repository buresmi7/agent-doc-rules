# Documentation Architecture

Use this rule when adding or changing project docs, rules, templates, skills,
or agent instructions.

## Core Rule

Each fact has one canonical home. Other files link to it.

If the same rule needs to appear in more than one place, keep the rule in the
lowest shared document and link to it from the others.

## Document Roles

- `AGENTS.md`: always-loaded invariants and routing pointers. Keep it short.
- Nested `AGENTS.md`: directory-specific rules that override or extend parent
  rules.
- `README.md`: human entry point, repository overview, source-of-truth index,
  and first useful commands.
- `rules/`: cross-cutting policies used by multiple workflows.
- `references/`: long examples, command reference, API notes, and background
  loaded only when needed.
- `.agents/skills/<name>/SKILL.md`: one task-specific workflow, when the
  repository uses local skills.
- `.agents/skills/<name>/references/`: long skill examples and background
  loaded only when needed.
- `.codex/agents/`: optional custom subagent definitions.
- `.codex/hooks/`: optional hook scripts and behavior notes.
- Templates: reusable issue bodies, comments, prompts, reports, or agent docs.

## Placement Rules

- Put stable facts near the thing they describe.
- Put repeated workflow behavior in a workflow or skill document.
- Put cross-cutting policy in `rules/`.
- Put command reference in `references/`, not in always-loaded docs.
- Put setup, install, and repair procedures in the nearest `references/`
  directory, not in always-loaded docs or the root README.
- Put README quality rules in `rules/readme.md`; do not copy them into project
  README files.
- Put "why this rule exists" near the canonical rule. Use a short decision note
  when the trade-off matters.
- Move detail out when an always-loaded section grows past roughly ten lines.
- Prefer links over copied text.

## Validation

After changing documentation links, run the consuming project's Markdown link
check if one exists.

When no automated checker exists, manually verify local relative links in:

- `AGENTS.md`
- nested `AGENTS.md` files
- `rules/`
- `templates/`
- root documentation

After changing shared rules or agent instructions, review nearby docs for
semantic duplicates. Remove duplicated prose and leave links to the canonical
rule.
