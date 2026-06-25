---
name: agent-doc-rules
description: Maintain repo-level AGENTS.md, README.md, docs placement, and agent workflow extraction. Use for agent docs, documentation architecture, plain-English repository documentation, overlays, and stale-doc repair; do not use as a general product-doc writer.
---

# Agent Doc Rules

Use this skill to keep repository instructions and documentation small,
canonical, plain, and easy for agents and people to use.

## Workflow

1. Inspect the repository before editing. Identify existing `AGENTS.md`,
   `README.md`, docs, templates, local overrides, and verification commands.
2. Load only the references needed for the task:
   - For `AGENTS.md`, read [references/agents-rules.md](references/agents-rules.md).
   - For `AGENTS.md` reviews, also read
     [references/agents-rubric.md](references/agents-rubric.md).
   - For documentation writing, rewriting, or style cleanup, read
     [references/writing-style.md](references/writing-style.md).
   - For README work, read
     [references/readme-rules.md](references/readme-rules.md) and
     [references/writing-style.md](references/writing-style.md). If the README
     carries a long runbook or procedure, also read
     [docs/context-placement.md](docs/context-placement.md) and
     [references/doc-audit.md](references/doc-audit.md).
   - For README reviews, also read
     [references/readme-rubric.md](references/readme-rubric.md).
   - For documentation placement, canonical homes, or skill/template structure,
     read [docs/context-placement.md](docs/context-placement.md) and
     [references/documentation-architecture.md](references/documentation-architecture.md).
   - For repairing bloated docs, moving inbox notes, or auditing duplicated
     durable facts, read [references/doc-audit.md](references/doc-audit.md).
   - For documentation validation or duplicate checks, read
     [references/validation.md](references/validation.md).
3. When starter content is useful, adapt the templates in
   [assets/templates/](assets/templates/) instead of copying unrelated prose.
4. Keep each reusable rule in one canonical file. Link to canonical rules from
   other files instead of duplicating them.
5. Preserve project-specific facts from the consuming repository, but do not
   invent or carry forward unsupported workflows, tools, services, hosts, issue
   processes, or commands. When a manifest such as `package.json` exists, use it
   to verify documented scripts. Do not infer hidden harness commands such as
   `test:agent` unless they are visible in the target project manifest and
   relevant to the user's task.
6. Before finishing README, `AGENTS.md`, docs, skill, reference, or template
   changes, run or name the repository's relevant Markdown, link, or
   documentation checks. Prefer `npm run docs:check` when it exists. If a check
   cannot run, state why and the residual risk.

For context-placement or notes-triage tasks, make one pass over every source
fact and assign it to a canonical home:

- `README.md` for project purpose, first useful command, and a compact docs
  index.
- `docs/` reference pages for schemas, commands, APIs, and contracts.
- `docs/` explanation or architecture pages for rationale and trade-offs.
- `docs/` how-to or troubleshooting pages for fixture failures and repair
  steps.
- `AGENTS.md` for short routing, local invariants, verification commands, and
  the skipped-check residual-risk rule.
- The original inbox file, such as `notes.md`, should be removed or reduced to a
  short pointer after durable facts move.

For design influences and attribution, see
[references/influences.md](references/influences.md).

## Output Rules

- Keep always-loaded agent instructions concise and scannable.
- If existing docs already satisfy the task, make no file changes. Do not
  rewrite compliant docs for style-only normalization.
- Write repository docs in plain, concrete English unless the consuming
  repository sets a different language rule.
- When creating or repairing `AGENTS.md`, include a short `Shared Rules` or
  `Skill Reference` section that links to
  `.agents/skills/agent-doc-rules/references/agents-rules.md`; do not copy the
  referenced rule text.
- Keep troubleshooting, setup, release, and repair procedures in human docs;
  put only routing links and short invariants in `AGENTS.md`.
- Move ordinary human runbooks to `docs/` and link to them; do not turn them
  into task-specific skills unless they are repeated agent workflows.
- For documentation placement tasks, put rationale and trade-off explanations in
  durable `docs/` explanation or architecture files, not in schema, importer,
  command, or API reference pages. Put fixture failure or repair steps in
  `docs/` how-to or troubleshooting files. Keep `README.md`, reference docs,
  and `AGENTS.md` to short pointers for those details.
- When project notes describe a repeated workflow meant for agents, create or
  update a task-specific `.agents/skills/<name>/SKILL.md` and link to it instead
  of storing the full workflow in the README or `AGENTS.md`.
- When adding a project skill, create or update `AGENTS.md` with a short routing
  pointer to that skill; do not copy the full workflow there.
- When adding verification guidance, include the command or check and state that
  skipped checks need a reason and residual-risk note.
- When a repository exposes `docs:check`, prefer it for README, `AGENTS.md`,
  docs, skill, reference, and template changes.
- Put detailed procedures in references, docs, runbooks, or task-specific
  skills.
- When moving facts out of an inbox file such as `notes.md`, remove that inbox
  file or reduce it to a short pointer; do not leave duplicated durable facts
  behind.
- Make local overrides explicit, narrow, and easy to find.
- Keep persisted content in the language required by the consuming repository.
- Do not include secrets, account IDs, private host names, customer identifiers,
  or environment-specific notes in reusable docs.
