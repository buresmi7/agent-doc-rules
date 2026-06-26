# Tool Map

Use this page to choose the smallest `agent-doc-rules` surface for a task.

| Goal | Use | Why |
| --- | --- | --- |
| Create or repair `AGENTS.md` | `$agent-doc-rules` plus [`references/agents-rules.md`](../references/agents-rules.md) | Keeps always-loaded agent context short and local. |
| Review an `AGENTS.md` file | `$agent-doc-rules` plus [`references/agents-rubric.md`](../references/agents-rubric.md) | Checks routing, scope, duplication, and verification guidance. |
| Shape a README | `$agent-doc-rules` plus [`references/readme-rules.md`](../references/readme-rules.md) | Keeps the README as a human entry point. |
| Review a README | `$agent-doc-rules` plus [`references/readme-rubric.md`](../references/readme-rubric.md) | Finds stale commands, missing orientation, placeholders, and overlong sections. |
| Decide where a fact belongs | [`docs/context-placement.md`](context-placement.md) | Separates README, docs, `AGENTS.md`, skills, references, and templates. |
| Repair bloated docs | [`references/doc-audit.md`](../references/doc-audit.md) | Moves durable facts to canonical homes and removes duplicated leftovers. |
| Check factual claims | [`references/factual-review.md`](../references/factual-review.md) | Compares docs against local evidence and rejects unsupported edits. |
| Tighten prose | [`references/writing-style.md`](../references/writing-style.md) | Removes vague or generic text without inventing workflows. |
| Check deterministic prose wording | `agent-doc-rules-docs wording` | Runs `write-good` and optional project wording rules against Markdown prose. |
| Review sentence style | `agent-doc-rules-docs-duplicates style` | Uses Codex to review Markdown sentence units for clarity and plain language. |
| Validate Markdown and links | `agent-doc-rules-docs` | Runs deterministic Markdown and local-link checks. |
| Find likely duplicate docs | `agent-doc-rules-docs-duplicates` | Uses deterministic candidates before asking Codex to classify overlap. |

## Command Split

Use the deterministic validator first:

```bash
agent-doc-rules-docs check
```

Use duplicate review as a separate semantic gate:

```bash
agent-doc-rules-docs-duplicates check
```

The combined project script is usually:

```bash
pnpm run docs:check
```

## Agent Prompt Examples

Create instructions:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

Review stale README commands:

```text
Use $agent-doc-rules to review this README for stale commands and unsupported setup steps.
```

Place facts from notes:

```text
Use $agent-doc-rules to move durable facts from notes.md into README, docs, AGENTS, or a project skill.
```

Run factual review:

```text
Use $agent-doc-rules to review these docs for contradictions and unsupported claims.
```
