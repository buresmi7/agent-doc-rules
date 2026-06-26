# AGENTS.md Rules

Use this rule when creating or maintaining `AGENTS.md` files. For review, also
use [AGENTS.md review rubric](agents-rubric.md).

## Purpose

`AGENTS.md` is an always-loaded entry point for AI agents. It should provide
orientation, local invariants, and links to deeper docs.

It is a navigation layer, not full documentation.

## Core Rules

- Keep `AGENTS.md` short enough to scan quickly.
- Use short sections with bullets and links.
- Store detailed procedures in `rules/`, `references/`, skills, or component
  docs.
- Do not copy shared rules into project `AGENTS.md`; link to the shared rule.
- When repairing a file that already copied shared rules, replace the copied
  block with a short `Shared Rules` section that links to the installed rule.
- State local overrides explicitly.
- Prefer nested `AGENTS.md` files for directory-specific rules.
- When adding a nested `AGENTS.md`, keep the root file short but point agents to
  the nested file before they edit that directory. Do not repeat the nested
  rules in the root file.

## Recommended Root Structure

```markdown
# Project Name - AI Agent Instructions

Brief project orientation.

## Shared Rules

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [README rules](.agents/skills/agent-doc-rules/references/readme-rules.md)
- [Documentation architecture](.agents/skills/agent-doc-rules/references/documentation-architecture.md)

## Local Rules

Project-specific invariants and overrides.

## Source Of Truth

Canonical project docs and decision records.

## Verification

Project-specific validation commands or checks. If a check cannot run, state why
and document the remaining risk.
```

## What To Include

- Brief project description.
- Links to shared rules and project docs.
- Local language, safety, security, or workflow overrides.
- Project-specific verification commands.
- A short rule that makes skipped verification visible. Existing local wording
  such as "say what remained unchecked" satisfies this; do not rewrite it only
  to match this reference's preferred wording.
- Pointers to issue, PR, or proposal conventions.

## What To Avoid

- Long architecture explanations.
- Full command references.
- Duplicated text from shared rules.
- Stale lists that should be generated or linked.
- Secrets, credentials, host names, or account IDs.

## Local Override Rule

When a project needs to override the shared core, write the override directly
and narrowly:

```markdown
## Local Overrides

- Persisted project artifacts are written in Czech.
- This local language rule overrides the English default in the shared core.
```

Local overrides should be rare, explicit, and easy to find.
