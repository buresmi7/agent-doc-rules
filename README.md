# Agent Doc Rules

Shared documentation and `AGENTS.md` rules for AI-assisted repositories.

This repository is the canonical source for reusable documentation conventions.
Projects consume these rules as a committed snapshot, then add a short local
overlay for project-specific constraints.

## What Belongs Here

- Documentation architecture rules.
- `AGENTS.md` structure and maintenance rules.
- Templates for project root instructions and local overlays.
- Small, stable guidance that can apply across multiple repositories.

## What Does Not Belong Here

- Project-specific workflows.
- Task manager or issue lifecycle commands.
- Forge, cloud, deployment, or runtime commands for one project.
- Secrets, credentials, host names, account IDs, or private environment notes.
- Long tutorials copied from vendor documentation.

## Consume As A Snapshot

Copy the shared files into a project under a path such as:

```text
agent-rules/shared/
  VERSION
  rules/
  templates/
```

The consuming repository should commit the snapshot. Do not rely on remote raw
links, submodules, or package installation for always-on agent rules.

Record the source version in `agent-rules/shared/VERSION`, for example:

```text
agent-doc-rules v0.1.0
```

## Local Project Overlay

Each project keeps its own root `AGENTS.md`. That file should:

- link to the snapshot rules,
- keep only local invariants and exceptions,
- avoid copying rules from the shared core,
- state when local rules override the shared core.

Use `templates/AGENTS.project.md` and `templates/AGENTS.overlay.md` as starting
points.

## Versioning

Use Git tags for released snapshots. Start with `v0.1.0`.

When a project updates the snapshot, update its `VERSION` file and review local
overlays for obsolete duplicated rules.
