# Docs Validator

`@agent-doc-rules/docs-validator` provides deterministic Markdown validation
for repositories that use the `agent-doc-rules` skill.

## Install

```bash
pnpm add -D @agent-doc-rules/docs-validator
```

## Commands

```bash
agent-doc-rules-docs markdown
agent-doc-rules-docs links
agent-doc-rules-docs check
```

`markdown` runs bundled `markdownlint-cli2`. `links` runs bundled `linkinator`
with Markdown parsing and fragment checking enabled by default. `check` runs
Markdown linting first and stops before link validation if linting fails.

## Config

The CLI reads `agent-doc-rules.config.json` from the repository root. CLI flags
override config values, and config values override built-in defaults.

```json
{
  "docs": {
    "include": ["*.md", "docs/**/*.md", "packages/**/*.md"],
    "exclude": ["node_modules/**", ".git/**"],
    "links": {
      "skip": ["^https://github.com/example/archived"]
    }
  }
}
```

Use `--skip <regex>` for repeated Linkinator skip patterns and `--no-fragments`
when fragment validation is too strict for a specific repository.
