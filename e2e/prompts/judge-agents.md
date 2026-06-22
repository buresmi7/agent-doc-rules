# Judge AGENTS.md

You are judging the root `AGENTS.md` produced for a temporary repository.

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
- Fail if the output copies shared rules instead of linking to them.
- Fail if the output invents project facts or tools.
- Fail if the output omits a critical requirement from the criteria.

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

Generated `AGENTS.md`:

```markdown
{{agentsMd}}
```
