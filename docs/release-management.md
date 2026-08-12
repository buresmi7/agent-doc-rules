# Release Management

Use this runbook to carry out the release model defined in
[Independent package versioning](decisions/independent-package-versioning.md).
That decision owns the release boundary and its rationale; this page owns the
procedure.

## Release Models

### Legacy Monorepo Releases

Tags from `v0.1.0` through `v0.11.0` identify snapshots of the whole
repository. Preserve these tags as immutable history.

Each legacy tag must have one GitHub Release titled
`agent-doc-rules <tag>`. Do not delete, rename, or move a published tag to make
the history look uniform. Tag `v0.1.6` is a lightweight historical tag; keep it
as the only known exception to the annotated-tag rule.

The package list in a historical Release must match what npm published for that
version:

| Tags | npm packages |
| --- | --- |
| `v0.1.0` through `v0.8.0` | None; these are source releases. |
| `v0.8.1` | `@buresmi7/agent-doc-rules-skill` |
| `v0.8.2` and `v0.9.0` | Skill, documentation validator, and duplicate checker |
| `v0.10.0` and `v0.11.0` | All four public packages |

### Independent Package Releases

Use these identities for releases governed by the independent model:

| Package | Release title | Tag pattern | Changelog |
| --- | --- | --- | --- |
| `@buresmi7/agent-doc-rules-skill` | `Agent Doc Rules Skill` | `agent-doc-rules-skill@VERSION` | `packages/agent-doc-rules-skill/CHANGELOG.md` |
| `@buresmi7/agent-e2e-runner` | `E2E Runner` | `agent-e2e-runner@VERSION` | `packages/agent-e2e-runner/CHANGELOG.md` |
| `@buresmi7/agent-e2e-report` | `E2E Report Format` | `agent-e2e-report@VERSION` | `packages/agent-e2e-report/CHANGELOG.md` |
| `@buresmi7/agent-doc-rules-docs-validator` | `Docs Validator` | `agent-doc-rules-docs-validator@VERSION` | `packages/docs-validator/CHANGELOG.md` |
| `@buresmi7/agent-doc-rules-docs-duplicates` | `Docs Duplicate Checker` | `agent-doc-rules-docs-duplicates@VERSION` | `packages/docs-duplicates/CHANGELOG.md` |

Do not create another unqualified `vMAJOR.MINOR.PATCH` tag. A release commit may
carry more than one package tag when it publishes several packages.

Title each package Release `<release title> <version>`, such as
`E2E Runner 0.12.0`. `release-packages.json` owns the short release title.
Start the body with an exact copy of the current package changelog entry below
its version heading. Do not copy the version heading or rewrite the entry. Keep
the full scoped npm package name and versioned npm link after it.

The root package is private and does not define public package versions.
Continue to test the whole workspace even when a release changes one package.
After the migration, the root changelog records only repository and monorepo
changes. Package behavior and publication history belong only in the matching
package changelog.

## Transition Checklist

The initial audit on 2026-07-24 found 19 legacy tags and nine GitHub Releases.
The following ten tags had no Release:

- `v0.1.0`
- `v0.2.0`
- `v0.3.0`
- `v0.4.0`
- `v0.5.0`
- `v0.6.0`
- `v0.7.0`
- `v0.8.0`
- `v0.8.1`
- `v0.11.0`

Complete the transition in this order:

- [x] Create and push the `v0.11.0` tag.
- [x] Publish version `0.11.0` of all four public packages.
- [x] Create the `v0.11.0` GitHub Release.
- [x] Backfill the other missing legacy Releases.
- [x] Standardize legacy Release titles and links.
- [x] Add independent version metadata and package changelogs.
- [x] Replace the lockstep release template and checklist.
- [x] Exercise the independent workflow with the next changed package.

The metadata-only `0.11.1` release completed this transition under a
[one-release verification exception](decisions/skip-full-release-verification-for-0.11.1.md).

Update this checklist in the same change that completes each item.

## Reconcile Legacy Tags And Releases

### 1. Capture The Existing State

Before editing public Release metadata:

1. Fetch tags and confirm that the local branch matches `origin`.
2. Export each existing Release name, body, assets, and target tag.
3. Record every tag name, tag type, target commit, and date.
4. Record the versions that npm exposes for each public package.
5. Keep the export outside the repository as a rollback reference.

Stop if a Release points to the wrong tag or a tag differs between the local
repository and `origin`.

### 2. Prepare Historical Release Notes

Use the `CHANGELOG.md` stored in the target tag, not the current changelog.
Keep claims within that tagged source and the npm versions that were actually
published.

For a missing Release:

- title it `agent-doc-rules <tag>`;
- state that it is a historical Release record when it is being backfilled;
- summarize the matching changelog entry;
- link to the tagged changelog;
- add a comparison with the previous tag when one exists;
- list only npm packages published for that version.

For an existing Release:

- preserve its substantive notes;
- standardize the title;
- add missing changelog and comparison links;
- do not replace or remove attached assets.

Release `v0.8.2` has four historical assets, including `SHA256SUMS.txt`. Preserve
their names and contents.

### 3. Apply And Verify

Create or edit one Release at a time. After each change, verify its title, tag,
body, assets, and public URL before continuing.

The reconciliation is complete when:

- all 19 legacy tags have one GitHub Release;
- every Release points to the existing tag with the same name;
- all titles use `agent-doc-rules <tag>`;
- package tables match npm history;
- `v0.8.2` still has its four assets;
- no tag target changed.

## Complete The Final Lockstep Release

Use this section only for `v0.11.0`.

1. Confirm that the tag points to the release commit.
2. Confirm that all four package manifests in the tag use `0.11.0`.
3. Confirm that npm exposes `0.11.0` for all four packages.
4. Draft the Release from the `v0.11.0` changelog entry and
   [the lockstep template stored in that tag](https://github.com/buresmi7/agent-doc-rules/blob/v0.11.0/.github/RELEASE_TEMPLATE.md).
5. Create `agent-doc-rules v0.11.0` for the existing tag.
6. Verify the package links, comparison link, changelog link, and public
   Release page.

Do not republish a package or recreate the tag when only the GitHub Release is
missing.

## Independent Release Controls

[`release-packages.json`](../release-packages.json) maps each public package to
its directory and tag prefix. The release tools reject public packages missing
from that file, duplicate identities, invalid SemVer values, package changelogs
that do not match their manifests, and new unqualified version tags.

Changesets records which packages should be released and whether each change is
major, minor, or patch. Its configuration keeps `fixed` and `linked` empty and
does not version or tag private packages. This makes the checked-in changeset,
not a file diff, the source of the SemVer decision.

Use these commands from the repository root:

| Command | Purpose |
| --- | --- |
| `corepack pnpm changeset` | Record affected public packages, SemVer bumps, and a user-visible summary. |
| `corepack pnpm run release:status` | Show the versions that pending changesets would produce. |
| `corepack pnpm run release:version` | Consume pending changesets and update only affected manifests and package changelogs. |
| `corepack pnpm run release:metadata` | Check package identities, independent-version configuration, changelog versions, and tag formats. |
| `corepack pnpm run release:check -- --phase PHASE --package PACKAGE` | Compare an intended package version with npm, Git tags, and its GitHub Release. |
| `corepack pnpm run release:tag -- --package PACKAGE` | Preview the exact package tag; add `--write` only after the release commit is clean. |

Repeat `--package PACKAGE` when one release commit contains several affected
packages. Package selectors may be npm names, tag prefixes, or configured
directories.

Do not use `changeset publish`. The repository uses its own unscoped package
tag format and keeps tagging, npm publication, and GitHub Release creation
behind separate verification steps.

Repository-only maintenance outside public package directories does not need a
changeset. When repository-only work touches a public package directory,
include an empty changeset:

```bash
corepack pnpm changeset --empty
```

State why the change does not need a package release. For historical changelog
corrections, use `pnpm pack --dry-run` to confirm that the changelog is not part
of the package artifact. Any change that alters a published package's behavior,
API, shipped documentation, dependencies, or artifact must include a non-empty
changeset.

## Prepare A Release

When a release is ready:

1. Fetch `master` and all tags, then confirm that the worktree starts clean.
2. Run `corepack pnpm run release:status` and review every affected package and
   bump.
3. Run `corepack pnpm run release:version`.
4. Confirm that only affected package manifests and changelogs changed.
5. Run `corepack pnpm run release:metadata`.
6. For each affected package, run the `prepared` release-state check:

   ```bash
   corepack pnpm run release:check -- --phase prepared --package PACKAGE
   ```

   This check requires a manifest version newer than npm latest and confirms
   that the exact npm version, package tag, and GitHub Release do not exist.
   For a package's first release, an absent npm latest version is expected.
7. Run the full gate before committing, tagging, or publishing:

   ```bash
   corepack pnpm run verify:release
   ```

Also review the pack output for each affected package:

| Package | Pack check |
| --- | --- |
| `@buresmi7/agent-doc-rules-skill` | `corepack pnpm --dir packages/agent-doc-rules-skill pack --dry-run` |
| `@buresmi7/agent-e2e-report` | `corepack pnpm --dir packages/agent-e2e-report pack --dry-run` |
| `@buresmi7/agent-e2e-runner` | `corepack pnpm --dir packages/agent-e2e-runner pack --dry-run` |
| `@buresmi7/agent-doc-rules-docs-validator` | `corepack pnpm --dir packages/docs-validator pack --dry-run` |
| `@buresmi7/agent-doc-rules-docs-duplicates` | `corepack pnpm --dir packages/docs-duplicates pack --dry-run` |

When the skill package changes:

- check that `npx skills add . --list` discovers `agent-doc-rules`;
- review external maintainer skill changes when the package manifest or
  `skills-lock.json` changed;
- check reusable content for secrets, private environment details, and
  unsupported project-specific rules.

When the E2E runner changes, check that its README install command and
dependency example use the version being published rather than `workspace:*`.

## Publish An Independent Package Release

After [Prepare A Release](#prepare-a-release):

1. Run `npm whoami` against the publication registry.
2. Commit the version changes and push the release commit.
3. Preview all intended tags. After reviewing them, create annotated tags:

   ```bash
   corepack pnpm run release:tag -- --package PACKAGE
   corepack pnpm run release:tag -- --package PACKAGE --write
   ```

   Select every affected package in one invocation when a commit releases more
   than one. The command refuses versions already on npm, versions not newer
   than npm latest, and conflicting local or remote tags.
4. Push every new tag to origin in one atomic operation:

   ```bash
   git push origin --atomic TAG [TAG...]
   ```

5. For each affected package, run:

   ```bash
   corepack pnpm run release:check -- --phase tagged --package PACKAGE
   ```

   This confirms that the local and remote annotated tag objects match, the tag
   points to the release commit, and neither npm nor GitHub has the release yet.
6. Run `npm publish --access public` from only the affected package
   directories. When the report format and runner are both new releases,
   publish `@buresmi7/agent-e2e-report` first because the runner depends on it.
7. Confirm each exact version with `npm view PACKAGE@VERSION version`.
8. Create one GitHub Release per tag with the
   [package release template](../.github/RELEASE_TEMPLATE.md). Use the
   configured `<release title> <version>`. Copy the current package changelog
   entry below its version heading without rewriting it, then link to the exact
   npm package version and the changelog stored in that tag.
9. Run the final state check:

   ```bash
   corepack pnpm run release:check -- --phase published --package PACKAGE
   ```

   It verifies the manifest in the tag, npm version, matching local and remote
   tag objects, configured Release title, exact current package changelog entry,
   versioned npm link, and tagged package-changelog link.

Publishing reserves an npm version permanently. Confirm authentication, package
contents, and the absence of that version before running `npm publish`.

If a tag was pushed but publication failed, fix the publication problem and
continue from the same tag. Do not move the tag. If npm publication succeeded
but the GitHub Release failed, create the missing Release without republishing.
