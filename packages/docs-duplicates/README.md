# Docs Duplicates

`@agent-doc-rules/docs-duplicates` checks documentation for likely semantic
duplicates. It uses a deterministic Markdown prefilter first, then asks Codex
to classify only the candidate pairs.

## Install

```bash
pnpm add -D @agent-doc-rules/docs-duplicates
```

## Command

```bash
agent-doc-rules-docs-duplicates check
```

The command resolves the bundled `@openai/codex` binary from this package. It
does not rely on `codex` being present in `PATH`.

Default model settings:

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
4. Send only candidate pairs to Codex.
5. Map structured Codex JSON to `fail`, `warn`, and `ok`.

`fail` returns a non-zero exit code. Warning-only results return zero.

## Config

Duplicate settings live under `docs.duplicates` in the root
`agent-doc-rules.config.json`. Command-line flags take precedence.

```json
{
  "docs": {
    "duplicates": {
      "includeReferences": false,
      "warnScore": 0.78,
      "failScore": 0.92,
      "model": "gpt-5-nano",
      "reasoningEffort": "low"
    }
  }
}
```

The duplicate-review workflow is derived from the earlier `meta-work`
documentation maintenance workflow, where deterministic duplicate candidates
were reviewed separately from Markdown and link checks.
