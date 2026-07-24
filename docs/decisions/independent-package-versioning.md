# Decision: Version Public Packages Independently

Status: Accepted
Date: 2026-07-24

## Context

The monorepo publishes four packages with separate purposes and no direct
runtime dependencies on one another. The lockstep release process gave every
package the same version, including packages whose contents had not changed.
This made each package's SemVer history less useful because a version bump did
not always mean that package had changed. It also required unnecessary npm
publications.

The repository also had more legacy Git tags than GitHub Releases. Rewriting
published tags would break stable references, while leaving the mismatch
unexplained would keep the release history ambiguous.

## Decision

Version `0.11.0` is the final lockstep release. Preserve tags `v0.1.0` through
`v0.11.0` as legacy monorepo tags and give each one a matching GitHub Release.
Do not rewrite their targets.

After `v0.11.0`, version and publish each public package independently. Use a
checked-in release record for each changed package, publish only packages whose
contents changed, and continue to run the full monorepo verification checks.

The [Release Management page](../release-management.md) defines the canonical
procedure, tag patterns, and GitHub Release rules.

## Trade-Off

Independent versions add release metadata, package changelogs, tags, and
GitHub Releases. A commit that releases several packages may have several tags.
Maintainers must check each package version instead of relying on one repository
version.

Backfilled historical Releases will show their actual creation date rather than
the original tag date. Their notes must identify them as historical records.

## Consequences

- Unchanged packages keep their current versions.
- A package's SemVer history describes changes to that package.
- Package changelogs record package behavior and publication history; the root
  changelog records repository and monorepo changes.
- Generic `vMAJOR.MINOR.PATCH` tags stop after `v0.11.0`.
- The private root package no longer acts as the public release version.
- Existing legacy tags remain valid and immutable.
- Release tooling must detect affected packages and verify npm, Git, and GitHub
  metadata for each version.

## Applies To

- Public package manifests and changelogs under `packages/` follow this release
  model.
- Release metadata and scripts in the repository root implement this decision.
- The [Release Management page](../release-management.md) defines Git tag
  identities, GitHub Release rules, and the release procedure.
- Maintainers use the [Monorepo Development](../development.md) page to find
  the release procedure.
- The [GitHub release template](../../.github/RELEASE_TEMPLATE.md) defines the
  package-specific Release format.

## Backlinks

- [Release Management](../release-management.md) links to this decision.
- [Monorepo Development](../development.md) links to this decision through the
  release checklist.
- The [GitHub release template](../../.github/RELEASE_TEMPLATE.md) sets the
  required package title, package version, and changelog link.

## Revisit When

- Reconsider independent versioning if public packages gain direct runtime
  dependencies that require matching versions.
- Reconsider this decision if independent release overhead outweighs the value
  of package-specific SemVer.
- Reconsider the tooling choice if the selected release tool cannot preserve
  package-specific tags and changelogs.
