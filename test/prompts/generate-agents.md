# Generate AGENTS.md

You are editing a temporary repository that has vendored `agent-doc-rules`.

Task mode: {{mode}}

Return JSON only with this shape:

```json
{
  "agentsMd": "complete root AGENTS.md content",
  "notes": "short implementation note"
}
```

Rules:

- Create or repair only the root `AGENTS.md` content.
- Keep `AGENTS.md` concise. It is an always-loaded navigation layer.
- Link or point to shared rules instead of copying their full text.
- Preserve project-specific facts from the project README and any existing `AGENTS.md`.
- Do not invent build commands, services, tools, owners, cloud accounts, issue systems, or technologies.
- Do not recommend optional skills, Notion, task-manager workflows, worktrees, or external tools.
- Include local overrides only when the project context supports them.
- Include source-of-truth and verification guidance when the project context supports them.

Shared rules:

```text
{{sharedRules}}
```

Project files:

```text
{{projectFiles}}
```
