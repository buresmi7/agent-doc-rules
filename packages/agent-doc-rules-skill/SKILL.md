---
name: agent-doc-rules
description: Use when a user asks to create a short root AGENTS.md, repair the existing root AGENTS.md, repair bloated AGENTS.md, remove copied or invented workflow text from AGENTS.md, create AGENTS.md, review AGENTS.md, improve README.md, maintain README.md, place docs, handle documentation architecture, run factual review, extract agent workflows, repair stale docs, write plain-English repo docs, or maintain overlays. Also use for the smallest reasonable repo update, temporary workaround, validation suppression, skipped check, rule exception, accepted trade-off, or decision record; do not use as a general product-doc writer.
---

# Agent Doc Rules

Use this skill to keep repository instructions and documentation small,
canonical, plain, and easy for agents and people to use.

## Workflow

1. Inspect the repository before editing. Identify existing `AGENTS.md`,
   `README.md`, docs, templates, local overrides, and verification commands.
2. Any root `AGENTS.md` you create, repair, or otherwise edit must include a
   brief project orientation from the local README or manifest, and a dedicated
   top-level `Shared Rules` or `Skill Reference` section linking to
   `.agents/skills/agent-doc-rules/references/agents-rules.md`. Do not copy
   shared-rule text into the project file, and do not bury the shared-rule link
   under `Source Of Truth`. Before returning an edited root `AGENTS.md`, verify
   that this section exists; without it, the file is incomplete.
3. Before making file changes, check whether the requested path is a shortcut
   that knowingly sacrifices quality, skips expected cleanup or verification,
   suppresses validation, violates a rule, or creates hidden debt. Phrases such
   as "smallest reasonable change", "avoid the full cleanup", "temporary
   workaround", or "validation suppression" are warning signs. If the answer is
   yes, do not edit files yet. Explain the trade-off, consequences, remaining
   risk, and repair path, then ask for explicit confirmation. For validation
   suppressions, name the exact finding the tool will stop reporting and the
   drift or defect that may grow while the suppression is active. A question such
   as "can we avoid the full cleanup?" is not confirmation; it is a request to
   evaluate the shortcut. Confirmation is valid only after the user accepts the
   described compromise. End the pre-confirmation response with a direct
   yes-or-no question asking whether the user explicitly accepts the compromise.
   If the confirmed change would need a linked decision record, say that before
   asking for confirmation. Do not create decision records, config exceptions,
   or validation suppressions while waiting for that confirmation. After
   confirmation, create or update a linked decision record when the compromise
   has lasting effect. Committed config exceptions, allowlist entries,
   `ignorePairs`, and validation suppressions always count as lasting effects
   while they remain in the repository. If a confirmed change adds one of these
   lasting exceptions, create or update the decision record in the same change
   and link to it from the affected config, code, docs, or agent instructions.
   If you cannot create that linked record, do not add the lasting exception.
4. For README improvement, rewrite, or simplification tasks, do not add setup,
   install, test, deployment, runtime, package-manager, or workspace steps
   unless local evidence supports that exact action. A manifest script such as
   `npm test` supports documenting that command only; it is not evidence for an
   install-dependencies step.
5. Load only the references needed for the task:
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
     [references/doc-audit.md](references/doc-audit.md). If the requested README
     change affects commands, versions, runtime support, compatibility, or
     another factual claim, also read
     [references/factual-review.md](references/factual-review.md).
   - For README reviews, also read
     [references/readme-rubric.md](references/readme-rubric.md).
   - For documentation placement, canonical homes, or skill/template structure,
     read [docs/context-placement.md](docs/context-placement.md) and
     [references/documentation-architecture.md](references/documentation-architecture.md).
   - For accepted trade-offs, user-approved shortcuts, rule exceptions, or
     decision logs, read
     [references/decision-records.md](references/decision-records.md).
   - For repairing bloated docs, moving inbox notes, or auditing duplicated
     durable facts, read [references/doc-audit.md](references/doc-audit.md) and
     [references/factual-review.md](references/factual-review.md).
   - For factual accuracy, contradictions, unsupported claims, stale facts, or
     misleading documentation review, read
     [references/factual-review.md](references/factual-review.md).
   - For documentation security review, agent-instruction abuse, secret
     exfiltration risks, or backdoor-style guidance, read
     [references/security-review.md](references/security-review.md).
   - For documentation validation or duplicate checks, read
     [references/validation.md](references/validation.md). For
     `agent-doc-rules.config.json` changes, also read
     [docs/config-reference.md](docs/config-reference.md).
6. When starter content is useful, adapt the templates in
   [assets/templates/](assets/templates/) instead of copying unrelated prose.
7. Keep each reusable rule in one canonical file. Link to canonical rules from
   other files instead of duplicating them.
8. Preserve project-specific facts from the consuming repository, but do not
   invent or carry forward unsupported workflows, tools, services, hosts, issue
   processes, or commands. When a manifest such as `package.json` exists, use it
   to verify documented scripts. Do not infer hidden harness commands such as
   `test:agent` unless they are visible in the target project manifest and
   relevant to the user's task.
9. Before finishing README, `AGENTS.md`, docs, skill, reference, or template
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
- `AGENTS.md` for short routing, local invariants, privacy or safety bans for
  committed docs and examples, verification commands, and the skipped-check
  residual-risk rule.
- The original inbox file, such as `notes.md`, should be removed or reduced to a
  short pointer after durable facts move.

For design influences and attribution, see
[references/influences.md](references/influences.md).

## Output Rules

- Keep always-loaded agent instructions concise and scannable.
- If existing docs already satisfy the task, make no file changes. Do not
  rewrite compliant docs for style-only normalization.
- Do not rewrite supported local skipped-check wording only to match this
  skill's preferred phrasing.
- Write repository docs in plain, concrete English unless the consuming
  repository sets a different language rule.
- Any root `AGENTS.md` you create, repair, or edit must put
  `.agents/skills/agent-doc-rules/references/agents-rules.md` in a dedicated
  top-level `Shared Rules` or `Skill Reference` section. Do not copy the
  referenced rule text, and do not bury the shared-rule link under
  `Source Of Truth`. If the section is missing, add it before returning the
  file.
- Root `AGENTS.md` files should start with a brief project orientation from the
  local README or manifest, not only generic section headings.
- When creating a nested `AGENTS.md`, add a short root `AGENTS.md` pointer that
  names the nested file path and says when agents should read it.
- Keep troubleshooting, setup, release, and repair procedures in human docs;
  put only routing links and short invariants in `AGENTS.md`.
- When simplifying existing docs, do not add generic setup, install, test,
  deployment, or package-manager steps unless the source docs, user request, or
  local manifests support them.
- During a style or plain-English rewrite, preserve concrete project behavior,
  limitations, and supported workflow facts from the source document unless
  stronger local evidence directly contradicts them. A partial checkout with
  no corroborating source or tests is not, by itself, a contradiction. Do not
  replace supported service facts with claims about what the checkout lacks.
- A documentation request does not authorize changing manifests, source code,
  configuration, tests, or other evidence just to make a requested claim true.
  When local evidence contradicts the requested documentation, leave both the
  documentation and its source of truth unchanged and report the conflict. Only
  change the supported behavior or compatibility contract when the user asks
  for that product change explicitly.
- Move ordinary human runbooks to `docs/` and link to them; do not turn them
  into task-specific skills unless they are repeated agent workflows.
- For documentation placement tasks, put rationale and trade-off explanations in
  durable `docs/` explanation or architecture files, not only in `README.md` and
  not in schema, importer, command, or API reference pages. Even a one-sentence
  reason needs a `docs/` owner; `README.md` may summarize and link. Put fixture
  failure or repair steps in `docs/` how-to or troubleshooting files. Keep
  `README.md`, reference docs, and `AGENTS.md` to short pointers for those
  details.
- During notes triage, treat facts introduced as a reason, rationale, why, or
  trade-off as explanation content. Create or update a `docs/` explanation or
  architecture page for that content instead of leaving the README as the only
  home.
- During notes triage, preserve source facts phrased as "do not mention",
  "do not include", "do not store", or "do not commit" as short safety rules in
  `AGENTS.md` when they affect public docs, committed examples, secrets, private
  names, customer data, or other sensitive content.
- When project notes describe a repeated workflow meant for agents, create or
  update a task-specific `.agents/skills/<name>/SKILL.md`. Replace the workflow
  at its original location with a short link to the skill instead of storing a
  second copy there.
- When adding a project skill, create or update `AGENTS.md` with a short routing
  pointer to that skill; do not copy the full workflow there.
- Extracting a workflow does not ask you to execute it. Do not create the
  workflow's release, migration, deployment, or other output unless the user
  also requested that result. A manifest version or other repository metadata
  alone does not identify the intended workflow target.
- When adding verification guidance, include the command or check and state that
  skipped checks need a reason and residual-risk note.
- Follow the shortcut quality gate in the workflow before applying config
  exceptions, validation suppressions, skipped checks, or other faster paths
  that knowingly leave debt. For config exceptions or validation suppressions,
  name the issue the check will no longer catch.
- When a confirmed shortcut adds a committed config exception, allowlist entry,
  `ignorePairs`, or validation suppression, also create or update a durable
  decision record and link to it from the affected surface, such as the config
  reason. The exception and the linked decision record are one change.
- When a repository exposes `docs:check`, prefer it for README, `AGENTS.md`,
  docs, skill, reference, and template changes.
- Put detailed procedures in references, docs, runbooks, or task-specific
  skills.
- When moving facts out of an inbox file such as `notes.md`, remove that inbox
  file or reduce it to a short pointer; do not leave duplicated durable facts
  behind.
- Make local overrides explicit, narrow, and easy to find.
- Keep persisted content in the language required by the consuming repository.
- Write the durable result, not the conversation that produced it. Turn
  supported project facts and requirements, durable rationale, and confirmed
  decisions into standalone project documentation.
  Do not fill gaps from field names, adjacent lists, or common practice.
  Unless project evidence states them, do not infer meanings, required status,
  mappings, transformations, cardinality, causes, or downstream behavior.
  When evidence supplies only a list of names, keep a bare list; do not add
  description, notes, source, mapping, or semantics columns.
  Omit prompts and replies, speaker labels, greetings and acknowledgements,
  agent work plans and status updates, task narration, tool traces, chat-session
  metadata, and session-specific temporary paths. Do not present superseded
  conversational instructions as current facts. Preserve them only when needed
  to explain a decision or maintain project history. Keep raw conversation only
  in an explicit transcript or conversation example whose purpose requires it.
- Do not include secrets, real customer names, emails, account IDs, private host
  names, tokens, or environment-specific notes in reusable docs. When source
  notes contain sensitive examples, keep only a short safety rule that names the
  sensitive categories to avoid. Preserve the categories supported by project
  evidence; do not turn this skill's generic examples into project-specific
  facts or broaden a narrower local rule.
