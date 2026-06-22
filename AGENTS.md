# Agent Doc Rules - AI Agent Instructions

This monorepo publishes the reusable `agent-doc-rules` Agent Skill. Keep the
repository generic; project-specific rules belong in consuming repositories.

## Repository Skill

Use `$agent-doc-rules` for changes to `AGENTS.md`, README files, skill
references, templates, E2E documentation scenarios, and documentation
architecture. The root package depends on the local skill workspace and
`corepack pnpm run skills:sync` installs it into `.agents/skills/`.

## Source Of Truth

- Skill entry point: `packages/agent-doc-rules-skill/SKILL.md`
- Canonical reusable rules: `packages/agent-doc-rules-skill/references/`
- Starter templates: `packages/agent-doc-rules-skill/assets/templates/`
- E2E workspace projects: `e2e/create-basic/project/` and
  `e2e/repair-bloated/project/`
- Monorepo support scripts: `tools/`

## Rules

- Use English for all persisted content in this repository.
- Keep always-loaded docs short; move reusable detail into the skill references.
- Do not duplicate canonical rules across root docs and skill references.
- Do not add project-specific commands, issue workflows, cloud accounts, host
  names, secrets, or private environment notes.
- The skill directory is a private pnpm workspace package so the root monorepo
  and E2E scenarios can depend on it with `workspace:*`.
- Keep each E2E scenario's `project/` directory as a standalone workspace
  project that installs its skill dependency through `npx skills add`.

## Maintenance

- Update `CHANGELOG.md` when changing released skill behavior or templates.
- Update `pnpm-lock.yaml` when workspace metadata changes.
- Before finishing, run `corepack pnpm test`.
- When the skill layout changes, also run `corepack pnpm run skills:sync` and
  `corepack pnpm run test:install`.
