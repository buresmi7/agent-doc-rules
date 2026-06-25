# E2E Rule Matrix

Use this matrix to connect a failed scenario to the rule surface it protects.
It is a maintainer map, not a replacement for the scenario criteria.

| Scenario | Primary Rule Surface | Protected Behavior |
| --- | --- | --- |
| [`compliant-noop`](../e2e/compliant-noop/criteria.md) | [`SKILL.md`](../packages/agent-doc-rules-skill/SKILL.md) output rules | Leave already-compliant docs unchanged and avoid style-only churn. |
| [`context-placement`](../e2e/context-placement/criteria.md) | [`docs/context-placement.md`](../packages/agent-doc-rules-skill/docs/context-placement.md) and [`documentation-architecture.md`](../packages/agent-doc-rules-skill/references/documentation-architecture.md) | Move each durable fact to README, docs, AGENTS, or skill according to reader and purpose. |
| [`create-agent-skill-from-workflow`](../e2e/create-agent-skill-from-workflow/criteria.md) | [`SKILL.md`](../packages/agent-doc-rules-skill/SKILL.md) workflow extraction rule and [`docs/context-placement.md`](../packages/agent-doc-rules-skill/docs/context-placement.md) | Turn repeated agent workflows into project skills without copying full workflows into README or AGENTS. |
| [`create-basic`](../e2e/create-basic/criteria.md) | [`agents-rules.md`](../packages/agent-doc-rules-skill/references/agents-rules.md) and `SKILL.md` always-loaded AGENTS rules | Create concise root AGENTS instructions with local facts, verification, and shared-rule links. |
| [`docs-validation-routing`](../e2e/docs-validation-routing/criteria.md) | [`validation.md`](../packages/agent-doc-rules-skill/references/validation.md) and `SKILL.md` docs-check preference | Route documentation changes to the consuming repo's docs validation gate without copying tool internals into AGENTS. |
| [`factual-change-rejection`](../e2e/factual-change-rejection/criteria.md) | [`factual-review.md`](../packages/agent-doc-rules-skill/references/factual-review.md) | Reject requested documentation edits that conflict with local evidence. |
| [`human-runbook-not-skill`](../e2e/human-runbook-not-skill/criteria.md) | [`docs/context-placement.md`](../packages/agent-doc-rules-skill/docs/context-placement.md) | Keep ordinary human runbooks in docs instead of converting them into agent skills. |
| [`local-language-override`](../e2e/local-language-override/criteria.md) | `SKILL.md` output rules and [`writing-style.md`](../packages/agent-doc-rules-skill/references/writing-style.md) | Preserve consuming-repo language rules while keeping paths and commands unchanged. |
| [`nested-agents-override`](../e2e/nested-agents-override/criteria.md) | [`agents-rules.md`](../packages/agent-doc-rules-skill/references/agents-rules.md) and `SKILL.md` nested pointer rule | Put directory-specific rules in nested AGENTS files and point to them from root. |
| [`plain-english-doc-review`](../e2e/plain-english-doc-review/criteria.md) | [`writing-style.md`](../packages/agent-doc-rules-skill/references/writing-style.md), [`readme-rules.md`](../packages/agent-doc-rules-skill/references/readme-rules.md), and factual guardrails | Remove generic prose without inventing setup, runtime, deploy, or package-manager details. |
| [`repair-bloated`](../e2e/repair-bloated/criteria.md) | [`doc-audit.md`](../packages/agent-doc-rules-skill/references/doc-audit.md), [`agents-rubric.md`](../packages/agent-doc-rules-skill/references/agents-rubric.md), and `SKILL.md` no-op rule | Reduce bloated AGENTS files to routing and local invariants while removing copied shared rules. |
| [`sensitive-notes-redaction`](../e2e/sensitive-notes-redaction/criteria.md) | `SKILL.md` sensitive category rule and [`docs/context-placement.md`](../packages/agent-doc-rules-skill/docs/context-placement.md) | Move safe facts while dropping sensitive example values and naming sensitive categories. |
| [`split-bloated-readme`](../e2e/split-bloated-readme/criteria.md) | [`readme-rules.md`](../packages/agent-doc-rules-skill/references/readme-rules.md), [`doc-audit.md`](../packages/agent-doc-rules-skill/references/doc-audit.md), and [`documentation-architecture.md`](../packages/agent-doc-rules-skill/references/documentation-architecture.md) | Keep README as an entry point and move architecture, release, and troubleshooting detail into docs. |
| [`stale-readme-commands`](../e2e/stale-readme-commands/criteria.md) | [`readme-rules.md`](../packages/agent-doc-rules-skill/references/readme-rules.md) and [`factual-review.md`](../packages/agent-doc-rules-skill/references/factual-review.md) | Verify README commands against manifests and remove unsupported scripts. |

When a scenario fails, fix the primary rule surface first if the behavior is
missing or ambiguous. Update criteria only when the rule is already clear and
the judge needs a sharper acceptance boundary.
