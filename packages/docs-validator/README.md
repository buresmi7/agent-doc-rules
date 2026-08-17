# Docs Validator

`@buresmi7/agent-doc-rules-docs-validator` provides deterministic documentation
validation for repositories that use the `agent-doc-rules` skills.

## Install

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-validator
```

## Commands

```bash
agent-doc-rules-docs init
agent-doc-rules-docs markdown
agent-doc-rules-docs wording
agent-doc-rules-docs security
agent-doc-rules-docs links
agent-doc-rules-docs duplicate-candidates --format json
agent-doc-rules-docs check
```

`init` creates a starter `agent-doc-rules.config.json`. Use
`agent-doc-rules-docs init --print` to preview the config without writing files.

`markdown`, `wording`, `security`, and `links` run the corresponding
deterministic phases. `check` runs them in that order and stops on the first
failure. `duplicate-candidates` emits evidence for the `docs-duplicate-review`
skill. It does not invoke an AI tool, require authentication, or access the
network.

Candidate similarity is not a pass or fail verdict. Finding candidates returns
exit code `0`; invalid arguments, configuration, or unreadable inputs return a
nonzero code. The current agent reviews each candidate in its surrounding
context and chooses the canonical owner.

The validator does not bundle an Agent Skill. Install the
[`agent-doc-rules` skill package](../agent-doc-rules-skill/README.md) to add
`docs-duplicate-review`. That skill requires this candidate command for a
complete duplicate review; the validator remains optional for other skill
workflows.

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
    },
    "security": {
      "allow": ["intentional fixture"]
    },
    "duplicateCandidates": {
      "includeReferences": false,
      "includeSameFile": false,
      "minSimilarity": 0.72,
      "minWords": 6,
      "minChars": 40,
      "maxCandidates": 50,
      "ignorePairs": []
    }
  }
}
```

Use `--skip <regex>` for repeated Linkinator skip patterns and `--no-fragments`
when fragment validation is too strict for a specific repository. Use
`docs.wording.writeGood` to tune the deterministic prose linter. Use
`docs.wording.forbiddenTerms` only for project-specific phrases that must fail.

## Duplicate candidate review

By default, the command compares all included Markdown files with each other.
Repeat `--focus <glob>` to compare only matching files against the full
included corpus:

```bash
agent-doc-rules-docs duplicate-candidates \
  --focus 'README.md' \
  --focus 'docs/changed/**/*.md' \
  --format json
```

Candidate IDs are derived from their file and prose content. Ordering is stable
for the same corpus. JSON output includes the corpus and focus files, a source
digest that binds the source units and candidate-selection scope, the
similarity value and signal for each pair, and pagination metadata. When
`pagination.truncated` is `true`, rerun the identical scan and add
`pagination.nextCursor`:

```bash
agent-doc-rules-docs duplicate-candidates \
  --focus 'README.md' \
  --focus 'docs/changed/**/*.md' \
  --format json \
  --cursor DUP-0123456789abcdef
```

Text output contains the same candidate locations and pagination state for
interactive use. `--min-similarity` sets the candidate threshold, and
`--max-candidates` controls the page size. Use `--include-references` or
`--include-same-file` only when those sources belong in the review. The
`duplicateCandidates` section accepts `include`, `exclude`,
`includeReferences`, `includeSameFile`, `minSimilarity`, `minWords`, `minChars`,
`maxCandidates`, and `ignorePairs`.

If a cursor is no longer present, restart from the first page. The source or
candidate-selection scope may have changed before the scanner could emit the
next page.

The old `docs.style` and `docs.duplicates` sections are unsupported. Remove the
`@buresmi7/agent-doc-rules-docs-duplicates` dependency and its `docs:style` and
`docs:duplicates` scripts. Also remove `@openai/codex` when it was installed
only as that checker's project-local fallback. Move deterministic settings to
`docs.duplicateCandidates`, rename `warnScore` to `minSimilarity`, and remove
`model`, `reasoningEffort`, `codexBin`, and `failScore`. Keep `docs:check` as
`agent-doc-rules-docs check`. The CLI reports stale config instead of silently
ignoring it. See the skill package's
[migration guide](../agent-doc-rules-skill/skills/agent-doc-rules/docs/adoption.md#replace-the-retired-duplicate-checker)
for the full replacement path.

Use `docs-duplicate-review` from the separate skill package for semantic
classification. Use the `agent-doc-rules` security-review reference to define
security scope.
