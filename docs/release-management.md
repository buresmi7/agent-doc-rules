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

| Package | Tag pattern | Changelog |
| --- | --- | --- |
| `@buresmi7/agent-doc-rules-skill` | `agent-doc-rules-skill@VERSION` | `packages/agent-doc-rules-skill/CHANGELOG.md` |
| `@buresmi7/agent-e2e-runner` | `agent-e2e-runner@VERSION` | `packages/agent-e2e-runner/CHANGELOG.md` |
| `@buresmi7/agent-doc-rules-docs-validator` | `agent-doc-rules-docs-validator@VERSION` | `packages/docs-validator/CHANGELOG.md` |
| `@buresmi7/agent-doc-rules-docs-duplicates` | `agent-doc-rules-docs-duplicates@VERSION` | `packages/docs-duplicates/CHANGELOG.md` |

Do not create another unqualified `vMAJOR.MINOR.PATCH` tag. A release commit may
carry more than one package tag when it publishes several packages.

Title each package Release `<npm package name> <version>`, such as
`@buresmi7/agent-doc-rules-skill 0.12.0`.

The root package is private and does not define public package versions.
Continue to test the whole workspace even when a release changes one package.
After the migration, the root changelog may summarize repository maintenance,
but it must not assign one version to all public packages.

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
- [ ] Add independent version metadata and package changelogs.
- [ ] Replace the lockstep release template and checklist.
- [ ] Exercise the independent workflow with the next changed package.

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
   [the lockstep template](../.github/RELEASE_TEMPLATE.md).
5. Create `agent-doc-rules v0.11.0` for the existing tag.
6. Verify the package links, comparison link, changelog link, and public
   Release page.

Do not republish a package or recreate the tag when only the GitHub Release is
missing.

## Prepare Independent Versioning

The implementation must provide these behaviors before the first independent
release:

- each change names the affected package and SemVer bump;
- only changed packages receive new versions;
- each public package has its own changelog;
- the root private package is not part of public version calculation;
- package tags follow the patterns in this document;
- each package tag gets one GitHub Release;
- the release template names one package and one version;
- release checks compare the manifest, npm version, tag, and GitHub Release;
- the full monorepo verification gate still runs.

Use Changesets or an equivalent checked-in metadata format. Do not infer the
SemVer bump only from a file diff.

## Prepare A Release

After applying version and changelog changes, run the full gate before
committing, tagging, or publishing:

```bash
corepack pnpm run verify:release
```

Then apply the checks for each affected package:

| Package | Pack check |
| --- | --- |
| `@buresmi7/agent-doc-rules-skill` | `corepack pnpm --dir packages/agent-doc-rules-skill pack --dry-run` |
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

Update the affected package changelog. Until independent package changelogs are
installed, update the root `CHANGELOG.md`.

## Publish An Independent Package Release

Use this sequence after the independent tooling is installed:

1. Add or review the checked-in release metadata for each changed package.
2. Apply the version changes and inspect the affected manifests and package
   changelogs.
3. Complete [Prepare A Release](#prepare-a-release).
4. Confirm npm authentication and that none of the intended versions exist.
5. Commit the version changes.
6. Create annotated package tags on that commit and push them atomically.
7. Publish only the tagged packages.
8. Verify each exact version on npm.
9. Create one GitHub Release for each package tag.
10. Verify the tag, npm package, changelog, and Release URL.

Publishing reserves an npm version permanently. Confirm authentication, package
contents, and the absence of that version before running `npm publish`.

If a tag was pushed but publication failed, fix the publication problem and
continue from the same tag. Do not move the tag. If npm publication succeeded
but the GitHub Release failed, create the missing Release without republishing.
