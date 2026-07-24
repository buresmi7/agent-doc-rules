# Changesets

Add a changeset when a change should publish one or more public packages:

```bash
corepack pnpm changeset
```

Select only affected packages, choose each SemVer bump, and describe the
user-visible package change. Repository-only maintenance does not need a
changeset.

Maintainers consume pending files with `corepack pnpm run release:version`.
The repository release tools then create the package-specific tags defined in
`release-packages.json`. Do not use `changeset publish`; the repository uses a
different tag format and keeps publication behind explicit verification.
