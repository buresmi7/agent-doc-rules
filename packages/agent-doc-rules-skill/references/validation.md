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

- Markdown formatting, local link checks, and high-signal security pattern
  checks belong in a deterministic docs validator.
- Semantic duplicate review belongs in a separate command because it can use an
  agent model, network access, and paid tokens.

The `agent-doc-rules` tool packages follow this split:

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-validator @buresmi7/agent-doc-rules-docs-duplicates
```

Recommended scripts:

```json
{
  "scripts": {
    "docs:markdown": "agent-doc-rules-docs markdown",
    "docs:wording": "agent-doc-rules-docs wording",
    "docs:security": "agent-doc-rules-docs security",
    "docs:style": "agent-doc-rules-docs-duplicates style",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicates": "agent-doc-rules-docs-duplicates check",
    "docs:check": "agent-doc-rules-docs check && agent-doc-rules-docs-duplicates style && agent-doc-rules-docs-duplicates check"
  }
}
```

Create a starter config before tuning include, exclude, link, or duplicate
settings:

```bash
agent-doc-rules-docs init
```

Use `agent-doc-rules-docs init --print` when you want to inspect the config
without writing files.

Use wording validation for deterministic prose linting. The default checker uses
`write-good` with a low-noise profile. Add project-specific forbidden terms only
when a repository has a phrase that must fail.

Use security validation as a deterministic first pass for agent-facing docs. It
flags high-risk command snippets, secret disclosure instructions,
prompt-injection wording, validation bypasses, backdoor-style guidance, remote
images, tracking links, and encoded execution payloads. Keep allow patterns
narrow and prefer rewriting examples that look like real instructions.

Use AI style review when the check needs sentence-level judgment. Keep it
bounded: send parsed Markdown sentence units, cap the number of units, and
return structured `fail`, `warn`, and `ok` findings.

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
