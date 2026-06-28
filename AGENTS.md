# Agent Doc Rules - AI Agent Instructions

This maintainer workspace builds `agent-doc-rules`; see `README.md` for the
project overview. Keep the repository generic; project-specific rules belong in
consuming repositories.

## Repository Skill

Use `$agent-doc-rules` for changes to `AGENTS.md`, README files, skill
references, templates, E2E documentation scenarios, and documentation
architecture. The root package depends on the local skill workspace. Run
`corepack pnpm run skills:sync` to install it into `.agents/skills/` with the
project-scoped maintainer skills.

## Project Skills

This repository keeps project-scoped maintainer skills under `.agents/skills/`:

- Use `$skill-creator` when creating, changing, evaluating, or improving the
  published skill.
- Use `$doc-coauthoring` for substantial design docs, decision docs, specs, or
  similar structured writing.
- Use `$documentation-writer` for Diataxis-style user documentation.
- Use `$docmd-writer` when reviewing documentation prose, page structure, and
  code-block conventions from the npm-sourced writer skill.
- Use `$meta-skill` when evaluating, designing, or refining reusable Agent
  Skills.
- Use `$plain-english` before finishing docs or prose changes to simplify
  English and reduce generic AI prose.
- Use `$update-markdown-file-index` when maintaining Markdown indexes of files
  or directories.

Keep generated maintainer skill files and their source links documented in
`docs/maintainer-skills.md`.

## Source Of Truth

- Skill entry point: `packages/agent-doc-rules-skill/SKILL.md`
- Skill human README: `packages/agent-doc-rules-skill/README.md`
- Skill product docs: `packages/agent-doc-rules-skill/docs/`
- Canonical reusable rules: `packages/agent-doc-rules-skill/references/`
- Starter templates: `packages/agent-doc-rules-skill/assets/templates/`
- Monorepo developer docs: `docs/development.md`
- Rule placement rubric: `docs/rule-placement.md`
- E2E failure triage: `docs/e2e-failure-triage.md`
- E2E rule matrix: `docs/e2e-rule-matrix.md`
- Markdown/docs validator: `packages/docs-validator/`
- Semantic duplicate checker: `packages/docs-duplicates/`
- npm-sourced maintainer skill dependencies:
  `packages/agent-doc-rules-skill/package.json`
- Project-scoped maintainer skill lockfile: `skills-lock.json`
- Maintainer skill sync procedure: `docs/maintainer-skills.md`
- Project cleanup checklist: `docs/project-cleanup.md`
- Generated project-scoped maintainer skills: `.agents/skills/`
- E2E workspace projects: `e2e/*/project/`
- Command E2E scenario configs: `e2e/*/scenario.json`
- Monorepo support scripts: `tools/`

## Rules

- Use English for repository files that are committed or generated for reuse.
- Keep files that agents read by default short; move reusable detail into the
  skill references.
- Do not duplicate canonical rules across root docs and skill references.
- Keep the root `README.md` as a short monorepo entry point. It should say what
  the repository is for, link to `packages/agent-doc-rules-skill/README.md` for
  the main package, and link to `docs/development.md` for monorepo development.
  Put other monorepo detail in `docs/`.
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
- When an E2E scenario fails, use `docs/e2e-failure-triage.md` and
  `docs/rule-placement.md` before changing skill rules or criteria.

## Maintenance

- Use the release checklist in `docs/development.md` for changelog and publish
  preparation requirements.
- Review external skill updates before committing lockfile changes; follow the
  maintainer-skill guidance in `docs/maintainer-skills.md`. Commit the
  lockfile, not generated external skill copies.
- Update `pnpm-lock.yaml` when workspace metadata or project skill package
  dependencies change.
- Use `docs/project-cleanup.md` before finishing changes to docs, skills,
  validation tools, E2E tests, installation documentation, release workflows, or
  runtime behavior that affect more than one file.
- Before finishing, run `corepack pnpm test`.
- For documentation validation changes, also run `corepack pnpm run
  docs:check`.
- When the skill layout changes, also run `corepack pnpm run skills:sync` and
  `corepack pnpm run test:install`.
- Before tagging a release, run `corepack pnpm run verify:release`.
