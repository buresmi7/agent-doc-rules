# Decision: Skip Full Release Verification for 0.11.1

Status: Accepted for 0.11.1
Date: 2026-07-30

## Context

Release `0.11.1` changes only npm package metadata. It adds repository,
homepage, and issue tracker links to all four public package manifests. It does
not change package behavior, dependencies, executable code, or shipped
documentation.

The release metadata checks, prepared-state checks, and package dry runs
completed successfully. The full `verify:release` command did not complete
successfully because its model-based E2E scenarios were not stable across
repeated runs.

## Decision

Publish `0.11.1` without a successful full `verify:release` run. Keep all other
release controls, including npm authentication, package-specific tags, exact
npm version checks, GitHub Releases, and final published-state checks.

This is a one-release exception. It does not create a general metadata-only
release path and must not be reused for later releases.

## Trade-Off And Consequences

The package metadata and release identities have been checked, but the release
will not prove that the complete model-based E2E suite was green at its tagged
commit. The residual risk is an unrelated skill behavior regression that the
completed deterministic checks did not detect.

The exception keeps a metadata-only correction from being blocked by
non-deterministic model output. It also weakens the normal release evidence for
this version.

## Applies To

- Version `0.11.1` of the four public packages.
- The four package-specific `0.11.1` tags and GitHub Releases.
- The transition checklist in [Release Management](../release-management.md).

## Backlinks

- [Release Management](../release-management.md) links to this decision from
  the transition checklist.

## Revisit When

- Do not apply this exception to another version.
- Run the full release gate for the next release.
- Investigate and stabilize model-based E2E scenarios separately from this
  metadata correction.
