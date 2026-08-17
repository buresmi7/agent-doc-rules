# Agent Doc Rules Skills

This package provides two Agent Skills for repository documentation:

- `agent-doc-rules` owns documentation architecture, `AGENTS.md`, README,
  factual and security review, and plain-English style review.
- `docs-duplicate-review` classifies semantic overlap from deterministic
  duplicate candidates and chooses a canonical owner.

The agent already working in the repository performs both judgment-based
reviews. Beyond that host agent, the skills do not start another AI CLI or
require a separate AI login, model configuration, or model-provider service.

## Install

Install both skills from npm into the current project:

```bash
npx @buresmi7/agent-doc-rules-skill
```

Replace existing copies of these two skills:

```bash
npx @buresmi7/agent-doc-rules-skill install --force
```

The installer writes only:

```text
.agents/skills/
├── agent-doc-rules/
└── docs-duplicate-review/
```

It preserves every unrelated directory under `.agents/skills/`. It checks both
destinations before writing and attempts to restore both owned skills if
installation fails. If restoration is incomplete, it retains the backups and
reports their recovery paths.

Preview the operation without writing files:

```bash
npx @buresmi7/agent-doc-rules-skill install --dry-run
```

The package also follows standard skill discovery. From a repository checkout
or unpacked package root, list or install its skills with the `skills` CLI:

```bash
npx skills add . --list
npx skills add . --skill agent-doc-rules --skill docs-duplicate-review -y --copy
```

## Use The Skills

Apply documentation architecture and style rules:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

```text
Use $agent-doc-rules to review this README for unsupported claims and plain-English style.
```

```text
Use $agent-doc-rules to review these docs for factual accuracy, contradictions,
and unsupported claims.
```

Review semantic duplication:

```text
Use $docs-duplicate-review to classify semantic duplication in the changed documentation.
```

`agent-doc-rules` loads detailed references only when the task needs them. Its
plain-English review lives in
[`writing-style.md`](skills/agent-doc-rules/references/writing-style.md).

`docs-duplicate-review` first uses deterministic candidate evidence, then asks
the host agent to inspect both passages and classify them with the
[`classification rubric`](skills/docs-duplicate-review/references/classification-rubric.md).
A similarity score ranks candidates; it never becomes the verdict.

## Deterministic Validation

Install the validator for Markdown, wording, security, links, and
duplicate-candidate generation:

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-validator
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

The validator is optional for other `agent-doc-rules` workflows, but a complete
`docs-duplicate-review` requires its deterministic candidate command.

`docs:check` is a deterministic CI gate. Finding duplicate candidates does not
fail CI because semantic ownership requires repository context. Run the
candidate command as evidence for `$docs-duplicate-review`:

```bash
pnpm run docs:duplicate-candidates
```

Existing users of the retired duplicate checker should follow the
[migration steps](skills/agent-doc-rules/docs/adoption.md#replace-the-retired-duplicate-checker).

## Documentation

- [Adoption Guide](skills/agent-doc-rules/docs/adoption.md)
- [Tool Map](skills/agent-doc-rules/docs/tool-map.md)
- [Config Reference](skills/agent-doc-rules/docs/config-reference.md)
- [Context Placement](skills/agent-doc-rules/docs/context-placement.md)
- [Recipes](skills/agent-doc-rules/docs/recipes.md)
- [Validation Guidance](skills/agent-doc-rules/references/validation.md)

## Development

From the monorepo root:

```bash
corepack pnpm install
corepack pnpm run skills:sync
corepack pnpm run test:install
corepack pnpm test
```

Run agent E2E tests only when the configured host-agent runner is available:

```bash
corepack pnpm run test:agent
```
