# Docs AI Review

`@agent-doc-rules/docs-duplicates` provides Codex-backed documentation review.
It checks likely semantic duplicates and can review Markdown sentences for
style issues.

## Install

```bash
pnpm add -D @agent-doc-rules/docs-duplicates
```

## Command

```bash
agent-doc-rules-docs-duplicates check
agent-doc-rules-docs-duplicates style
```

`check` and `duplicates` run semantic duplicate review. `style` runs AI review
for Markdown sentences.

The command resolves the bundled `@openai/codex` binary from this package. It
does not rely on `codex` being present in `PATH`.

Default model settings for both AI checks:

- model: `gpt-5-nano`
- reasoning effort: `low`

`gpt-5-nano` is the default because duplicate review is a classification task
and OpenAI positions the nano GPT-5 variant as the fastest, lowest-cost GPT-5
option for tasks such as summarization and classification.

Use `--model <model>` or `agent-doc-rules.config.json` when your Codex account
does not expose the default model.

## Flow

1. Parse Markdown prose into text units.
2. Skip code blocks, short noise, and `references/` directories by default.
3. Build candidates with normalized exact matching, shingle overlap, word
   overlap, and string similarity.
4. Remove candidates that match configured `ignorePairs`.
5. Send only candidate pairs to Codex.
6. Map structured Codex JSON to `fail`, `warn`, and `ok`.

`fail` returns a non-zero exit code. Warning-only results return zero.

## Style Review

Style review parses Markdown into sentence units, sends only those units to
Codex, and asks for `fail` or `warn` findings. It is meant for judgment calls
such as unclear workflow names, vague AI-like phrasing, long sentences, or
sentences that are understandable but need a maintainer rewrite.

Use deterministic wording checks for known banned terms. Use AI style review
when the question depends on the sentence.

## Config

Duplicate settings live under `docs.duplicates` in the root
`agent-doc-rules.config.json`. Command-line flags take precedence.

```json
{
  "docs": {
    "duplicates": {
      "includeReferences": false,
      "ignorePairs": [
        {
          "left": "^e2e/",
          "right": "^e2e/",
          "reason": "E2E fixtures intentionally repeat scenario facts."
        }
      ],
      "warnScore": 0.78,
      "failScore": 0.92,
      "model": "gpt-5-nano",
      "reasoningEffort": "low"
    },
    "style": {
      "includeReferences": false,
      "maxUnits": 80,
      "model": "gpt-5-nano",
      "reasoningEffort": "low"
    }
  }
}
```

The duplicate-review workflow is derived from the earlier `meta-work`
documentation maintenance workflow, where deterministic duplicate candidates
were reviewed separately from Markdown and link checks.

See the skill package [Config Reference](../agent-doc-rules-skill/docs/config-reference.md)
for shared include, exclude, wording, and AI style settings.
