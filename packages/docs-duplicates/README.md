# Docs AI Review

`@buresmi7/agent-doc-rules-docs-duplicates` provides Codex-backed documentation review.
It checks likely semantic duplicates and can review Markdown sentences for
style issues.

## Install

```bash
pnpm add -D @buresmi7/agent-doc-rules-docs-duplicates
```

## Command

```bash
agent-doc-rules-docs-duplicates check
agent-doc-rules-docs-duplicates style
```

`check` and `duplicates` run semantic duplicate review. `style` runs AI review
for Markdown sentences.

## Codex CLI Requirement

`check` and `style` require Codex CLI 0.142.0 or later. The selected executable
must report a compatible version through `codex --version`. This package does
not install Codex by default or download an executable at runtime.

The command selects an executable in this order:

1. An explicit `--codex-bin`, `docs.duplicates.codexBin`, or
   `docs.style.codexBin` value. The CLI flag overrides the matching config
   value.
2. A compatible `codex` executable from `PATH`.
3. A compatible project-local `@openai/codex` installation.

Install Codex on `PATH`:

```bash
npm install --global @openai/codex
```

Run the same command to update an existing npm installation. To opt into the
project-local fallback instead, install Codex in the project that runs the
review:

```bash
pnpm add -D @openai/codex
```

Authenticate the selected CLI before running a review, then check its status.
These commands assume that the executable is on `PATH`:

```bash
codex login
codex login status
```

For the project-local fallback, replace `codex` with `pnpm exec codex`. For an
explicit executable path, run the same subcommands through that executable.

Codex also supports API-key authentication. See the
[Codex authentication documentation](https://developers.openai.com/codex/auth)
for the supported sign-in methods.

The authenticated account must have access to the configured model. Both
review commands require outbound access to the configured model provider,
consume model usage, and can incur API charges.

Both commands invoke `codex exec` with a read-only sandbox and an ephemeral
session. This keeps agent actions read-only and avoids persisted session files;
it does not remove the model-provider network requirement.

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

See the skill package [Config Reference](../agent-doc-rules-skill/docs/config-reference.md)
for `ignorePairs` fields and shared include, exclude, wording, and AI style
settings.

The duplicate-review workflow is derived from the earlier `meta-work`
documentation maintenance workflow, where deterministic duplicate candidates
were reviewed separately from Markdown and link checks.
