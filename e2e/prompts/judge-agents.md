# Judge Generated Documentation

You are judging generated documentation and agent-context files for a temporary
repository.

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
- Fail if the output omits a critical requirement from the criteria.
- Fail if the output invents project facts, tools, services, commands, or
  workflows not supported by the project context.
- Fail if the output copies reusable shared rules when the criteria require
  linking or concise routing.

Scenario criteria:

```text
{{criteria}}
```

Installed skill reference:

```text
{{skillReference}}
```

Original project context before generation:

```text
{{originalProjectFiles}}
```

Project context:

```text
{{projectFiles}}
```

Generated files:

```text
{{generatedFiles}}
```
