---
name: agent-doc-rules
description: Maintain concise AGENTS.md, README.md, and repository docs. Use for agent docs and overlays.
---

# Agent Doc Rules

Use this skill to keep repository instructions and documentation small,
canonical, and easy for agents to route from.

## Workflow

1. Inspect the repository before editing. Identify existing `AGENTS.md`,
   `README.md`, docs, templates, local overrides, and verification commands.
2. Load only the references needed for the task:
   - For `AGENTS.md`, read [references/agents-md.md](references/agents-md.md).
   - For README work, read [references/readme.md](references/readme.md).
   - For README reviews, also read
     [references/readme-rubric.md](references/readme-rubric.md).
   - For documentation placement, canonical homes, or skill/template structure,
     read
     [references/documentation-architecture.md](references/documentation-architecture.md).
3. When starter content is useful, adapt the templates in
   [assets/templates/](assets/templates/) instead of copying unrelated prose.
4. Keep each reusable rule in one canonical file. Link to canonical rules from
   other files instead of duplicating them.
5. Preserve project-specific facts from the consuming repository, but do not
   invent workflows, tools, services, hosts, issue processes, or commands.
6. Before finishing, run or name the repository's relevant Markdown, link, or
   documentation checks. If a check cannot run, state why and the residual risk.

## Output Rules

- Keep always-loaded agent instructions concise and scannable.
- Put detailed procedures in references, docs, runbooks, or task-specific
  skills.
- Make local overrides explicit, narrow, and easy to find.
- Keep persisted content in the language required by the consuming repository.
- Do not include secrets, account IDs, private host names, customer identifiers,
  or environment-specific notes in reusable docs.
