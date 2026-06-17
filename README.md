# Agent Doc Rules

Reusable documentation and `AGENTS.md` rules for AI-assisted repositories.

`agent-doc-rules` gives teams a small, versioned baseline for repository
instructions, documentation architecture, and local project overlays. It is for
projects that want consistent AI-agent behavior without copying long rule blocks
between repositories.

## Why This Exists

AI agents work better when repository instructions are short, stable, and easy
to route from. The problem is that those instructions often grow into repeated
walls of process text across `AGENTS.md`, skills, templates, and project docs.

This library keeps the reusable parts in one place:

- how to structure `AGENTS.md`,
- where documentation rules should live,
- how to avoid duplicated agent instructions,
- how to separate shared rules from local project overrides.

Projects vendor a released snapshot, then add their own local rules on top.

## What Is Included

```text
rules/
  agents-md.md
  documentation-architecture.md

templates/
  AGENTS.project.md
  AGENTS.overlay.md
```

| Path | Purpose |
| --- | --- |
| `rules/agents-md.md` | Rules for concise `AGENTS.md` files that link to deeper docs. |
| `rules/documentation-architecture.md` | Canonical homes for rules, references, templates, and always-loaded docs. |
| `templates/AGENTS.project.md` | Starter root `AGENTS.md` for a consuming repository. |
| `templates/AGENTS.overlay.md` | Starter local override file for project-specific constraints. |

## What Is Not Included

This repository deliberately does not contain:

- project-specific workflows,
- issue lifecycle commands,
- task manager or worktree conventions,
- forge, cloud, deployment, or runtime commands,
- secrets, account IDs, host names, or private environment notes,
- copied vendor tutorials.

Keep those in the consuming project.

## Install In A Project

Consume this repository as a committed snapshot. This keeps always-on agent
rules available offline and avoids submodule or package-manager setup.

1. Choose a release tag, for example `v0.1.2`.
2. Copy the released `rules/` and `templates/` directories into the consuming
   project:

   ```text
   agent-rules/shared/
     VERSION
     rules/
     templates/
   ```

3. Record the source version:

   ```text
   agent-doc-rules v0.1.2
   ```

4. Create or update the project root `AGENTS.md`:

   ```markdown
   ## Shared Rules

   - [AGENTS.md rules](agent-rules/shared/rules/agents-md.md)
   - [Documentation architecture](agent-rules/shared/rules/documentation-architecture.md)

   ## Local Overrides

   - Persisted project artifacts are written in Czech.
   - This local rule overrides the shared core.
   ```

5. Remove duplicated prose from the project `AGENTS.md`; keep only local
   invariants, links, and explicit overrides.

## Update A Project Snapshot

When a new release is available:

1. Compare the release diff.
2. Replace the vendored `agent-rules/shared/rules/` and
   `agent-rules/shared/templates/` directories.
3. Update `agent-rules/shared/VERSION`.
4. Review local overlays and remove rules that are now covered by the shared
   core.
5. Check local Markdown links.

## Publishing Model

This repository is published through GitHub tags and releases:

- release tags use `vMAJOR.MINOR.PATCH`,
- release notes summarize rule and template changes,
- consumers update snapshots intentionally,
- `master` can move ahead of the latest release, but projects should vendor
  from tags.

The repository itself is the source of truth. GitHub topics, releases, and the
README make it discoverable; consuming projects should not depend on live remote
links at runtime.

## Optional Codex Skills For Maintainers

Public Codex skills that can help maintain this repository:

| Skill | When it helps |
| --- | --- |
| `gh-address-comments` | Work through GitHub PR or issue review comments with the `gh` CLI. |
| `security-best-practices` | Review future scripts or automation for secure defaults. |
| `cli-creator` | Useful later if this library grows a durable installer or snapshot-update CLI. |

The library does not require these skills. They are maintainer aids.

## Repository Health Checklist

For a public release, keep these current:

- clear README,
- MIT license,
- GitHub description and topics,
- release tag and GitHub Release,
- changelog entry,
- no project-specific or private environment details in shared rules.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule/template proposals.
