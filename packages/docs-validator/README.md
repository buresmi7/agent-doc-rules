# Docs Validator

`@buresmi7/agent-doc-rules-docs-validator` provides deterministic documentation
checks for repositories that use the `agent-doc-rules` skills.

## Install

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-validator@1.0.0
```

## First Check

Preview the generated starter config and package scripts without writing files:

```bash
agent-doc-rules-docs init --print
```

Review the output, then write `agent-doc-rules.config.json`:

```bash
agent-doc-rules-docs init
```

Add the printed scripts that fit the repository, then run:

```bash
agent-doc-rules-docs check
```

`check` runs Markdown, wording, security, and link validation in that order. It
stops on the first failed phase.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Preview or write a starter config and recommended package scripts. |
| `markdown` | Run Markdown linting. |
| `wording` | Run deterministic prose checks. |
| `security` | Scan documentation for high-risk instructions and content. |
| `links` | Validate Markdown links. |
| `duplicate-candidates` | Collect likely duplicate prose for agent review. |
| `check` | Run Markdown, wording, security, and link validation. |

Run `agent-doc-rules-docs --help` for command options.

## Configuration

The CLI reads `agent-doc-rules.config.json` from the repository root. CLI flags
override config values, and config values override built-in defaults.

Use `init --print` instead of copying a static config example. The
[config reference](../agent-doc-rules-skill/skills/agent-doc-rules/references/config-reference.md)
owns the supported keys, defaults, and exception guidance.

Keep fragment checking enabled by default. If a repository must use
`--no-fragments`, record why fragment validation cannot run and note that broken
heading anchors remain unverified. Apply the same reason and residual-risk rule
to skipped link patterns.

## Duplicate Review

Collect candidates for changed files with repeatable `--focus` flags:

```bash
agent-doc-rules-docs duplicate-candidates \
  --focus 'README.md' \
  --format json
```

Candidate similarity is evidence, not a pass or fail verdict. Finding candidates
returns exit code `0`. The command does not invoke an AI tool, require
authentication, or access the network.

Use the
[`docs-duplicate-review` skill](../agent-doc-rules-skill/skills/docs-duplicate-review/SKILL.md)
for pagination, contextual review, and classification.

## Migration

The old `docs.style` and `docs.duplicates` config sections are unsupported.
Follow the
[retired checker migration](../agent-doc-rules-skill/docs/adoption.md#replace-the-retired-duplicate-checker)
instead of maintaining a second migration procedure here.

## Verification

From the monorepo root, run:

```bash
corepack pnpm --filter @buresmi7/agent-doc-rules-docs-validator test
```
