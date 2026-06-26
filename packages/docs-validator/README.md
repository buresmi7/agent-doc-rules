# Docs Validator

`@agent-doc-rules/docs-validator` provides deterministic Markdown validation
for repositories that use the `agent-doc-rules` skill.

## Install

```bash
pnpm add -D @agent-doc-rules/docs-validator
```

## Commands

```bash
agent-doc-rules-docs init
agent-doc-rules-docs markdown
agent-doc-rules-docs wording
agent-doc-rules-docs links
agent-doc-rules-docs check
```

`init` creates a starter `agent-doc-rules.config.json`. Use
`agent-doc-rules-docs init --print` to preview the config without writing files.

`markdown` runs bundled `markdownlint-cli2`. `wording` runs a low-noise
`write-good` prose check and any optional project wording rules. `links` runs
bundled `linkinator` with Markdown parsing and fragment checking enabled by
default. `check` runs Markdown linting, wording validation, then link
validation, and stops on the first failure.

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
    },
    "wording": {
      "writeGood": {
        "passive": false,
        "illusion": false,
        "weasel": false,
        "adverb": false,
        "tooWordy": false,
        "eprime": false,
        "fail": false
      },
      "forbiddenTerms": [],
      "allow": ["intentional example"]
    }
  }
}
```

Use `--skip <regex>` for repeated Linkinator skip patterns and `--no-fragments`
when fragment validation is too strict for a specific repository. Use
`docs.wording.writeGood` to tune the deterministic prose linter. Use
`docs.wording.forbiddenTerms` only for project-specific phrases that must fail.

AI sentence-level style review lives in
`@agent-doc-rules/docs-duplicates` as
`agent-doc-rules-docs-duplicates style`.

See the skill package [Config Reference](../agent-doc-rules-skill/docs/config-reference.md)
for the full config model.
