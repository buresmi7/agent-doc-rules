# Agent Doc Rules - AI Agent Instructions

This repository stores reusable documentation and `AGENTS.md` rules. Keep this
repository generic; project-specific details belong in consuming repositories.

## Rules

- Use English for all persisted content in this repository.
- Keep always-on docs short. Move detail into `rules/` or `templates/`.
- Do not add project-specific commands, issue workflows, cloud accounts, host
  names, or environment notes.
- Keep each rule in one canonical file. Other files should link to it instead
  of copying it.
- Treat `README.md` as the user-facing entry point.
- Treat `rules/` as the authoritative reusable rule set.
- Treat `templates/` as starter content that projects copy and adapt.

## Maintenance

- Update `CHANGELOG.md` when changing released behavior or templates.
- Prefer small, stable rules over broad process.
- Before finishing, check links manually or with the consuming project's
  Markdown link checker.
