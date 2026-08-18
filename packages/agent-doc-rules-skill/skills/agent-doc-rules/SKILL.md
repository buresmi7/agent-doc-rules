---
name: agent-doc-rules
description: Use when a user asks to create or repair AGENTS.md, improve or review README.md, place repository docs, handle documentation architecture, run factual or security review, extract agent workflows, repair stale docs, write or review plain-English repository docs, maintain overlays, or record accepted documentation trade-offs. Do not use as a general product-doc writer or for a corpus-wide semantic duplicate review; use docs-duplicate-review for that.
---

# Agent Doc Rules

Use this skill to keep repository instructions and documentation small,
canonical, plain, and easy for agents and people to use.

## Workflow

1. Inspect the repository before editing. Identify existing `AGENTS.md`,
   `README.md`, docs, templates, local overrides, and verification commands.
2. Load only the references required by the task. Use the routing section below
   before changing a README, `AGENTS.md`, validator exception, decision record,
   or documentation layout.
3. Apply these hard gates before editing:
   - A root `AGENTS.md` needs a brief project orientation and a dedicated
     top-level `Shared Rules` or `Skill Reference` section linking to
     `.agents/skills/agent-doc-rules/references/agents-rules.md`. Link shared
     rules; do not copy them or bury the link under `Source Of Truth`.
   - README commands and workflow steps need exact repository evidence. A
     manifest script supports that command, not an inferred install or setup
     workflow.
   - If the request knowingly skips cleanup or verification, suppresses a
     finding, violates a rule, or creates debt, stop and follow
     [Decision Records](references/decision-records.md) before editing. Do not
     add a lasting config exception, allowlist entry, `ignorePairs` entry, or
     validation suppression without explicit acceptance and a decision record
     linked from the affected surface.
4. Give every durable fact one canonical owner. Keep only the context needed at
   other locations and link to the owner.
5. Preserve supported project facts. Do not invent commands, mappings,
   transformations, services, or workflows from names, adjacent lists, or
   common practice. A documentation request does not authorize changing code or
   configuration merely to make a claim true.
6. Write the durable result, not the conversation that produced it. Exclude
   prompts, replies, task narration, tool traces, and session paths unless the
   requested artifact is explicitly a transcript or conversation example.
7. When starter content is useful, adapt the templates in
   [assets/templates/](assets/templates/) instead of copying unrelated prose.
8. Before finishing README, `AGENTS.md`, docs, skill, reference, or template
   changes, run or name the repository's relevant Markdown, link, or
   documentation checks. Prefer `npm run docs:check` when it exists. If a check
   cannot run, state the reason and residual risk.

## Reference Routing

- For `AGENTS.md`, read [AGENTS.md Rules](references/agents-rules.md). For a
  review, also read [AGENTS.md Review Rubric](references/agents-rubric.md).
- For README work, read [README Rules](references/readme-rules.md) and
  [Documentation Writing Style](references/writing-style.md). For a review, also
  read [README Review Rubric](references/readme-rubric.md). If the README carries
  a runbook, also read [Context Placement](references/context-placement.md) and
  [Documentation Audit](references/doc-audit.md).
- For documentation writing, rewriting, or style review, read
  [Documentation Writing Style](references/writing-style.md). The current host
  agent applies its structured review directly; do not start another AI tool.
- For placement, canonical ownership, notes triage, or skill and template
  structure, read [Context Placement](references/context-placement.md) and
  [Documentation Architecture](references/documentation-architecture.md).
- For accepted trade-offs, shortcuts, skipped checks, rule exceptions, or
  validator suppressions, read [Decision Records](references/decision-records.md).
- For bloated or stale docs, read [Documentation Audit](references/doc-audit.md)
  and [Factual Documentation Review](references/factual-review.md).
- For factual accuracy, contradictions, unsupported claims, stale facts, or
  misleading documentation review, read
  [Factual Documentation Review](references/factual-review.md).
- For security review, instruction abuse, secret exfiltration, risky install
  examples, or backdoor guidance, read
  [Documentation Security Review](references/security-review.md).
- For deterministic checks, read
  [Documentation Validation](references/validation.md). For
  `agent-doc-rules.config.json`, also read
  [Validator Config Reference](references/config-reference.md).
- For corpus-wide semantic duplication, use `$docs-duplicate-review`.

## Placement And Output Constraints

- Leave compliant documentation unchanged; do not create style-only churn.
- Keep `AGENTS.md` short. Put procedures in human docs and reusable detail in
  references. When creating a nested `AGENTS.md`, add a short root pointer that
  names the nested path and when it applies.
- Keep README as the human entry point: purpose, first useful action, canonical
  links, and verification. Move long human runbooks into `docs/`.
- Put rationale and trade-offs in a durable explanation or architecture doc;
  do not leave README as the only owner. Remove or reduce an inbox file after
  its durable facts move.
- When project notes describe a repeated agent workflow, move it to a
  task-specific skill and leave a short Markdown link to the skill. A skill path
  in code formatting alone is not a link. Do not execute the extracted workflow
  unless the user requested its outcome.
- Do not add generic setup, install, test, deployment, or package-manager steps
  without local evidence. Preserve the consuming repository's language rule.
- Do not include secrets, real customer names, emails, account IDs, private
  hosts, tokens, or environment-specific notes in reusable docs. When source
  notes contain sensitive examples, preserve only their locally supported
  categories as a short `AGENTS.md` safety rule; a general anonymization rule
  does not replace that category list; do not turn this skill's generic
  examples into project-specific facts.
- When evidence supplies only names, keep a bare list. Do not infer meanings,
  required status, mappings, transformations, cardinality, causes, or downstream
  behavior.

For design influences and attribution, see
[references/influences.md](references/influences.md).
