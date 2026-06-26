# Config Reference

`agent-doc-rules` documentation tools read `agent-doc-rules.config.json` from
the repository root by default.

The file may contain a top-level `docs` object:

```json
{
  "docs": {
    "include": ["*.md", "docs/**/*.md", "**/AGENTS.md"],
    "exclude": ["node_modules/**", ".git/**", "dist/**", "coverage/**"],
    "links": {
      "skip": ["^https://example.invalid"],
      "checkFragments": true
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
    "style": {
      "includeReferences": false,
      "maxUnits": 80,
      "model": "gpt-5-nano",
      "reasoningEffort": "low"
    },
    "duplicates": {
      "includeReferences": false,
      "includeSameFile": false,
      "warnScore": 0.78,
      "failScore": 0.92,
      "minWords": 6,
      "minChars": 40,
      "maxCandidates": 50,
      "model": "gpt-5-nano",
      "reasoningEffort": "low"
    }
  }
}
```

CLI flags override config values. Config values override built-in defaults.

## Shared Keys

| Key | Type | Used By | Description |
| --- | --- | --- | --- |
| `docs.include` | string array | validator and duplicate checker | Markdown globs to include. |
| `docs.exclude` | string array | validator and duplicate checker | Globs to ignore. |

Default includes:

```json
[
  "*.md",
  "docs/**/*.md",
  "**/AGENTS.md",
  ".agents/skills/**/*.md",
  "packages/**/*.md",
  "rules/**/*.md",
  ".codex/**/*.md"
]
```

Default excludes:

```json
[
  "node_modules/**",
  ".git/**",
  "dist/**",
  "coverage/**",
  ".tmp/**",
  "repos/**",
  "worktrees/**"
]
```

## Link Keys

`docs.links` configures `agent-doc-rules-docs links` and the link phase of
`agent-doc-rules-docs check`.

| Key | Type | Description |
| --- | --- | --- |
| `docs.links.include` | string array | Optional include override for link validation. |
| `docs.links.exclude` | string array | Optional exclude override for link validation. |
| `docs.links.skip` | string array | Linkinator skip regexes. |
| `docs.links.checkFragments` | boolean | Whether to validate URL fragments. Defaults to `true`. |

Use `--skip <regex>` for one-off skip patterns and `--no-fragments` when a
repository has generated anchors the checker cannot resolve.

## Wording Keys

`docs.wording` configures `agent-doc-rules-docs wording` and the wording phase of
`agent-doc-rules-docs check`.

The validator runs `write-good` with a low-noise default profile. It skips
fenced code blocks, inline code, and Markdown tables. Optional configured
wording terms can still fail the check when a project has a phrase it must not
use.

| Key | Type | Description |
| --- | --- | --- |
| `docs.wording.include` | string array | Optional include override for wording validation. |
| `docs.wording.exclude` | string array | Optional exclude override for wording validation. |
| `docs.wording.writeGood` | object or `false` | `write-good` options. Set `fail: true` to make suggestions fail the command. Set `false` to disable `write-good`. |
| `docs.wording.forbiddenTerms` | string or object array | Optional project-specific terms that should fail. Objects use `term` and optional `suggest`. |
| `docs.wording.allow` | string array | Regexes for matching lines that should be ignored. |

The default `write-good` profile disables noisy checks for passive voice,
adverbs, weasel words, wordy phrases, lexical illusions, and E-Prime. Projects
can enable any supported `write-good` check in `docs.wording.writeGood`.

## AI Style Keys

`docs.style` configures `agent-doc-rules-docs-duplicates style`.

AI style review parses Markdown into sentence units, sends only those units to
Codex, and asks for structured findings. Use it when a review needs judgment
about sentence clarity, vague wording, passive phrasing, or workflow names that
do not explain the task.

| Key | Type | Description |
| --- | --- | --- |
| `docs.style.include` | string array | Optional include override for AI style review. |
| `docs.style.exclude` | string array | Optional exclude override for AI style review. |
| `docs.style.includeReferences` | boolean | Include `references/` directories. Defaults to `false`. |
| `docs.style.minWords` | number | Minimum words in a sentence unit. |
| `docs.style.minChars` | number | Minimum characters in a sentence unit. |
| `docs.style.maxUnits` | number | Maximum sentence units sent to Codex. |
| `docs.style.model` | string | Codex model for style review. |
| `docs.style.reasoningEffort` | string | Codex reasoning effort. |

## Duplicate Keys

`docs.duplicates` configures `agent-doc-rules-docs-duplicates check`.

| Key | Type | Description |
| --- | --- | --- |
| `docs.duplicates.include` | string array | Optional include override for duplicate review. |
| `docs.duplicates.exclude` | string array | Optional exclude override for duplicate review. |
| `docs.duplicates.includeReferences` | boolean | Include `references/` directories. Defaults to `false`. |
| `docs.duplicates.includeSameFile` | boolean | Compare prose units from the same file. Defaults to `false`. |
| `docs.duplicates.warnScore` | number | Minimum score for warning results. |
| `docs.duplicates.failScore` | number | Minimum score for failure results. |
| `docs.duplicates.minWords` | number | Minimum words in a prose unit. |
| `docs.duplicates.minChars` | number | Minimum characters in a prose unit. |
| `docs.duplicates.maxCandidates` | number | Maximum candidate pairs sent to Codex. |
| `docs.duplicates.model` | string | Codex model for classification. |
| `docs.duplicates.reasoningEffort` | string | Codex reasoning effort. |

The duplicate checker skips code blocks and short noise before it builds
candidates. It sends only candidate pairs to Codex.

## Init Command

Create a starter config:

```bash
agent-doc-rules-docs init
```

Preview it without writing:

```bash
agent-doc-rules-docs init --print
```

Overwrite an existing config only when the project has reviewed the replacement:

```bash
agent-doc-rules-docs init --force
```
