# Documentation Validation

Use this reference when a repository has documentation validation tooling or
when you add it.

## Preferred Checks

Prefer the repository's own validation scripts. When a project exposes
`docs:check`, use it for documentation, README, `AGENTS.md`, skill, and template
changes:

```bash
npm run docs:check
```

If the repository uses pnpm or another package manager, keep the local wrapper:

```bash
corepack pnpm run docs:check
```

When `docs:check` is not available, run or name the closest available Markdown,
link, or documentation checks. If a check cannot run, state the reason and the
remaining risk.

## Recommended Tool Split

Keep deterministic validation separate from semantic review:

- Markdown formatting and local link checks belong in a deterministic docs
  validator.
- Semantic duplicate review belongs in a separate command because it can use an
  agent model, network access, and paid tokens.

The `agent-doc-rules` tool packages follow this split:

```bash
pnpm add -D @agent-doc-rules/docs-validator @agent-doc-rules/docs-duplicates
```

Recommended scripts:

```json
{
  "scripts": {
    "docs:markdown": "agent-doc-rules-docs markdown",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicates": "agent-doc-rules-docs-duplicates check",
    "docs:check": "agent-doc-rules-docs check && agent-doc-rules-docs-duplicates check"
  }
}
```

## Duplicate Review

Duplicate review should not send the whole repository to an agent. First collect
candidate pairs with deterministic matching, then ask the agent to classify only
those candidates.

Use this result model:

- `fail` for repeated durable facts, rules, or procedures that should be
  deduplicated.
- `warn` for overlap that needs a maintainer decision.
- `ok` for acceptable repetition.

The duplicate workflow is derived from the earlier `meta-work` documentation
maintenance workflow, where Markdown/link checks and semantic duplicate review
were separate gates.
