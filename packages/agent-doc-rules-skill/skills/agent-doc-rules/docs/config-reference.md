# Config Reference

The deterministic documentation validator reads
`agent-doc-rules.config.json` from the repository root by default.

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

CLI flags override config values. Config values override built-in defaults.

## Shared Keys

| Key | Type | Description |
| --- | --- | --- |
| `docs.include` | string array | Markdown globs included by validator commands. |
| `docs.exclude` | string array | Globs ignored by validator commands. |

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
  ".agent-e2e-output/**",
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

Use `--skip <regex>` for a one-off pattern. Use `--no-fragments` when generated
anchors cannot be resolved by the checker.

## Wording Keys

`docs.wording` configures `agent-doc-rules-docs wording` and the wording phase
of `agent-doc-rules-docs check`.

The validator runs `write-good` with a low-noise default profile. It skips
fenced code blocks, inline code, and Markdown tables. Configured project terms
can still fail the check.

| Key | Type | Description |
| --- | --- | --- |
| `docs.wording.include` | string array | Optional include override for wording validation. |
| `docs.wording.exclude` | string array | Optional exclude override for wording validation. |
| `docs.wording.writeGood` | object or `false` | `write-good` options. Set `fail: true` to fail on suggestions or `false` to disable it. |
| `docs.wording.forbiddenTerms` | string or object array | Project terms that fail. Objects use `term` and optional `suggest`. |
| `docs.wording.allow` | string array | Regexes for lines ignored by wording checks. |

The default profile disables noisy checks for passive voice, adverbs, weasel
words, wordy phrases, lexical illusions, and E-Prime. Enable only checks that
fit the repository.

## Security Keys

`docs.security` configures `agent-doc-rules-docs security` and the security
phase of `agent-doc-rules-docs check`.

The validator scans Markdown text and code blocks for high-risk instructions,
secret disclosure, prompt-injection language, validation bypasses, backdoor
guidance, remote images, tracking links, and encoded execution payloads.

| Key | Type | Description |
| --- | --- | --- |
| `docs.security.include` | string array | Optional include override for security validation. |
| `docs.security.exclude` | string array | Optional exclude override for security validation. |
| `docs.security.allow` | string array | Regexes for lines ignored by security validation. |

Keep allow patterns narrow. Prefer rewriting examples that look like real
instructions.

## Duplicate Candidate Keys

`docs.duplicateCandidates` configures the deterministic scanner:

```bash
agent-doc-rules-docs duplicate-candidates --format json
```

| Key | Type | Description |
| --- | --- | --- |
| `docs.duplicateCandidates.include` | string array | Optional include override for candidate generation. |
| `docs.duplicateCandidates.exclude` | string array | Optional exclude override for candidate generation. |
| `docs.duplicateCandidates.includeReferences` | boolean | Include `references/` directories. Defaults to `false`. |
| `docs.duplicateCandidates.includeSameFile` | boolean | Compare units from the same file. Defaults to `false`. |
| `docs.duplicateCandidates.minSimilarity` | number | Lowest similarity from `0` through `1` to include. |
| `docs.duplicateCandidates.minWords` | number | Minimum words in a prose unit. |
| `docs.duplicateCandidates.minChars` | number | Minimum characters in a prose unit. |
| `docs.duplicateCandidates.maxCandidates` | number | Maximum pairs returned in one page. |
| `docs.duplicateCandidates.ignorePairs` | object array | Symmetric file-pair regexes excluded before output. |

Candidate generation skips code blocks and short noise. A candidate is evidence
for `$docs-duplicate-review`, not an automatic failure. The command exits
successfully when it finds candidates.

Use repeatable `--focus <path-or-glob>` flags to compare changed files with the
full corpus. Verify that the reported focus files contain every intended path.
When a JSON page reports `pagination.truncated`, rerun the identical scan with
`--cursor <pagination.nextCursor>` added. Restart if a later page reports a
different `sourceDigest`; the digest binds source units and candidate-selection
scope. Also restart from the first page if the scanner rejects a cursor as
missing. Use `--include-references` when canonical reference docs belong in the
review.

Use `ignorePairs` only for known overlaps such as fixtures repeating a rule
under test. Each entry uses `left` and `right` regex strings. Add a `reason` and
link a decision record when the exclusion will remain in the repository.

Style has no validator configuration. The host agent uses `$agent-doc-rules`
and loads `references/writing-style.md` for plain-English or structured style
review.

## Init Command

Create a starter config:

```bash
agent-doc-rules-docs init
```

Preview it without writing:

```bash
agent-doc-rules-docs init --print
```

Overwrite an existing config only after reviewing the replacement:

```bash
agent-doc-rules-docs init --force
```
