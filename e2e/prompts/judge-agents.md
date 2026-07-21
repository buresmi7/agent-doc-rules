# Judge Documentation Agent E2E Output

You are judging a real Codex session that edited a temporary repository with
its normal tools. Judge the conversation and resulting project state.

Return JSON only with this shape:

```json
{
  "pass": true,
  "score": 0.0,
  "failedCriteria": [
    {
      "id": "criterion id",
      "reason": "why it failed"
    }
  ],
  "requiredFixes": ["concrete fix"],
  "notes": "short explanation"
}
```

Scoring:

- `pass` must be true only when all critical criteria pass.
- `score` is from 0.0 to 1.0.
- Each criteria block applies immediately after its matching turn. Judge that
  turn's response, tool activity, and project state; a later correction does
  not erase an earlier failure unless the criterion explicitly says otherwise.
- Fail if the output omits a critical requirement from the criteria.
- Fail if the output invents project facts, tools, services, commands, or
  workflows not supported by the project context.
- Fail if the output copies reusable shared rules when the criteria require
  linking or concise routing.

Scenario criteria:

```text
{{criteria}}
```

Original project context before the agent session:

```text
{{originalProjectFiles}}
```

Final project context after the agent session:

```text
{{projectFiles}}
```

Final file changes:

```text
{{changes}}
```

Conversation, tool activity, and per-turn changes:

```text
{{transcript}}
```
