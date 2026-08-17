# Documentation Validation

Use this reference when a repository has documentation validation tooling or
when you add it.

## Contents

- [Preferred Checks](#preferred-checks)
- [Recommended Tool Split](#recommended-tool-split)
- [Repository Self-Compliance](#repository-self-compliance)
- [Duplicate Review](#duplicate-review)

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
- Candidate generation belongs in the deterministic validator.
- Plain-English and semantic duplicate decisions belong to the host agent that
  is already working in the repository.

The `agent-doc-rules` tool packages follow this split:

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-validator@1.0.1
```

Recommended scripts:

```json
{
  "scripts": {
    "docs:markdown": "agent-doc-rules-docs markdown",
    "docs:wording": "agent-doc-rules-docs wording",
    "docs:security": "agent-doc-rules-docs security",
    "docs:links": "agent-doc-rules-docs links",
    "docs:duplicate-candidates": "agent-doc-rules-docs duplicate-candidates --format json",
    "docs:check": "agent-doc-rules-docs check"
  }
}
```

Create a starter config before tuning include, exclude, link, or candidate
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

For sentence-level style judgment, the current host agent should use
`$agent-doc-rules` and load [writing-style.md](writing-style.md). This review is
not part of the deterministic CI gate.

## Repository Self-Compliance

When a repository publishes documentation rules or skills, add local tests for
its own stable, mechanical contracts. Useful checks include:

- required entry-point links and verified commands,
- standard skill layout, metadata limits, and progressive disclosure,
- machine-readable ownership for lasting validation exceptions, and
- complete decision-record fields and backlinks.

Run these checks from both the main test gate and `docs:check` so documentation
changes cannot bypass them. Keep semantic style and duplicate-ownership
judgment with the active agent; do not encode those decisions as brittle phrase
or similarity assertions.

## Duplicate Review

Run the deterministic scanner before semantic review:

```bash
agent-doc-rules-docs duplicate-candidates --format json
```

Then use `$docs-duplicate-review`. The host agent reads both passages in
context and classifies only relevant candidates. Candidate scores rank review
work; they do not determine the result.

Use this result model:

- `fail` for repeated durable facts, rules, or procedures that should be
  deduplicated.
- `warn` for overlap that needs a maintainer decision.
- `ok` for acceptable repetition.

Finding candidates exits successfully. Keep `docs:check` deterministic and use
the skill review as an explicit repository-maintenance step.
