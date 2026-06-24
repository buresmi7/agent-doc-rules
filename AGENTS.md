# Agent Doc Rules - AI Agent Instructions

This monorepo publishes the reusable `agent-doc-rules` Agent Skill. Keep the
repository generic; project-specific rules belong in consuming repositories.

## Repository Skill

Use `$agent-doc-rules` for changes to `AGENTS.md`, README files, skill
references, templates, E2E documentation scenarios, and documentation
architecture. The root package depends on the local skill workspace and
`corepack pnpm run skills:sync` installs it into `.agents/skills/` with the
project-scoped maintainer skills.

## Project Skills

This repository also restores a small project-scoped skill set under
`.agents/skills/` for maintainer work:

- Use `$skill-creator` when creating, changing, evaluating, or improving the
  published skill.
- Use `$doc-coauthoring` for substantial design docs, decision docs, specs, or
  similar structured writing.
- Use `$documentation-writer` for Diataxis-style user documentation.
- Use `$docmd-writer` when reviewing documentation prose, page structure, and
  code-block conventions from the npm-sourced writer skill.
- Use `$meta-skill` when evaluating, designing, or refining reusable Agent
  Skills.
- Use `$plain-english` as a final pass for simpler English and less generic AI
  prose.
- Use `$update-markdown-file-index` when maintaining Markdown indexes of files
  or directories.

Do not treat these restored maintainer skills as part of the published
`agent-doc-rules` skill artifact.

## Source Of Truth

- Skill entry point: `packages/agent-doc-rules-skill/SKILL.md`
- Skill human README: `packages/agent-doc-rules-skill/README.md`
- Skill product docs: `packages/agent-doc-rules-skill/docs/`
- Canonical reusable rules: `packages/agent-doc-rules-skill/references/`
- Starter templates: `packages/agent-doc-rules-skill/assets/templates/`
- Markdown/docs validator: `packages/docs-validator/`
- Semantic duplicate checker: `packages/docs-duplicates/`
- npm-sourced maintainer skill dependencies:
  `packages/agent-doc-rules-skill/package.json`
- Project-scoped maintainer skill lockfile: `skills-lock.json`
- Maintainer skill sync procedure: `docs/maintainer-skills.md`
- Generated project-scoped maintainer skills: `.agents/skills/`
- E2E workspace projects: `e2e/*/project/`
- Monorepo support scripts: `tools/`

## Rules

- Use English for all persisted content in this repository.
- Keep always-loaded docs short; move reusable detail into the skill references.
- Do not duplicate canonical rules across root docs and skill references.
- Do not add project-specific commands, issue workflows, cloud accounts, host
  names, secrets, or private environment notes.
- The skill directory is a private pnpm workspace package so the root monorepo
  and E2E scenarios can depend on it with `workspace:*`.
- Keep npm-compatible project skill packages in the skill workspace
  `devDependencies` and list the installed skill names in
  `agentDocRules.projectSkills`.
- Keep all external project skills locked in `skills-lock.json`; restore them
  with `corepack pnpm run skills:sync`.
- Keep each E2E scenario's `project/` directory as a standalone workspace
  project that installs its skill dependency through `npx skills add`.

## Maintenance

- Update `CHANGELOG.md` when changing released skill behavior or templates.
- Review external skill updates before committing lockfile changes; keep the
  risk model in `docs/maintainer-skills.md`. Commit the lockfile, not generated
  external skill copies.
- Update `pnpm-lock.yaml` when workspace metadata or project skill package
  dependencies change.
- Before finishing, run `corepack pnpm test`.
- For documentation validation changes, also run `corepack pnpm run
  docs:check`.
- When the skill layout changes, also run `corepack pnpm run skills:sync` and
  `corepack pnpm run test:install`.
