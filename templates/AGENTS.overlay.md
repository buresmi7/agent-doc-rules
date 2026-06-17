# Local Agent Rules Overlay

Use this template when a project consumes `agent-doc-rules` but needs local
rules that are not reusable across repositories.

## Shared Core

This project consumes `agent-doc-rules` from:

```text
agent-rules/shared/VERSION
```

Shared rules apply unless this file states a narrower local override.

## Local Overrides

- Add language, security, workflow, or phase constraints specific to this
  project.
- Keep overrides explicit and avoid copying shared rules.

## Project Sources Of Truth

- Add canonical docs, specifications, decision logs, or issue templates.

## Project Verification

- Add project-specific test, lint, validation, or manual review steps.
