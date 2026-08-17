# Tool Map

Use this page to choose the smallest `agent-doc-rules` surface for a task.

| Goal | Use | Why |
| --- | --- | --- |
| Create or repair `AGENTS.md` | `$agent-doc-rules` plus [`references/agents-rules.md`](../references/agents-rules.md) | Keeps always-loaded agent context short and local. |
| Review an `AGENTS.md` file | `$agent-doc-rules` plus [`references/agents-rubric.md`](../references/agents-rubric.md) | Checks routing, scope, duplication, and verification guidance. |
| Shape a README | `$agent-doc-rules` plus [`references/readme-rules.md`](../references/readme-rules.md) | Keeps the README as a human entry point. |
| Review a README | `$agent-doc-rules` plus [`references/readme-rubric.md`](../references/readme-rubric.md) | Finds stale commands, missing orientation, placeholders, and overlong sections. |
| Decide where a fact belongs | [`docs/context-placement.md`](context-placement.md) | Separates README, docs, `AGENTS.md`, skills, references, and templates. |
| Record an accepted trade-off | [`references/decision-records.md`](../references/decision-records.md) and [`assets/templates/decision-record.md`](../assets/templates/decision-record.md) | Keeps lasting compromises visible from the affected code or docs. |
| Repair bloated docs | [`references/doc-audit.md`](../references/doc-audit.md) | Moves durable facts to canonical homes and removes duplicated leftovers. |
| Check factual claims | [`references/factual-review.md`](../references/factual-review.md) | Compares docs against local evidence and rejects unsupported edits. |
| Review documentation security risks | [`references/security-review.md`](../references/security-review.md) and `agent-doc-rules-docs security` | Finds agent-instruction abuse, data leaks, validation bypasses, and tracking assets. |
| Tighten prose | [`references/writing-style.md`](../references/writing-style.md) | Removes vague or generic text without inventing workflows. |
| Check deterministic prose wording | `agent-doc-rules-docs wording` | Runs `write-good` and optional project wording rules against Markdown prose. |
| Review sentence style | `$agent-doc-rules` plus [`references/writing-style.md`](../references/writing-style.md) | The current host agent applies plain-English rules with repository context. |
| Validate Markdown, security, and links | `agent-doc-rules-docs` | Runs deterministic Markdown, security, and local-link checks. |
| Generate likely duplicate pairs | `agent-doc-rules-docs duplicate-candidates --format json` | Produces deterministic evidence without treating similarity as a verdict. |
| Review semantic duplicate docs | `$docs-duplicate-review` | The current host agent inspects candidate context and chooses a canonical owner. |

## Command Split

Use the deterministic validator first:

```bash
agent-doc-rules-docs check
```

Generate candidates separately for host-agent review:

```bash
agent-doc-rules-docs duplicate-candidates --format json
```

Keep the deterministic project gate separate:

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

Record a compromise:

```text
Use $agent-doc-rules to record the accepted shortcut and link it from the affected docs.
```

Run factual review:

```text
Use $agent-doc-rules to review these docs for contradictions and unsupported claims.
```

Review semantic overlap:

```text
Use $docs-duplicate-review to classify semantic duplication in the changed documentation.
```
