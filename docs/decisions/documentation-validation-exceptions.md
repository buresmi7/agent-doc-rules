# Decision: Govern Documentation Validation Exceptions

Status: Accepted
Date: 2026-08-17

## Context

The repository validates production documentation and committed E2E fixture
projects with one root configuration. Some fixtures intentionally contain bad
security examples or repeated prose that their scenarios need. Historical
release records and reserved example URLs also cannot be treated like current,
live documentation. Generated project-skill copies repeat their canonical
package sources and may contain reviewed third-party material.

The previous configuration skipped every HTTPS link, excluded whole fixture
scenario directories, ignored every duplicate pair anywhere under an E2E tree,
and retained file-pair rules that no longer matched a candidate. Those patterns
could hide unrelated link failures, unsafe fixture additions, or new semantic
drift without leaving a durable explanation.

## Decision

Keep only exceptions that match a current finding and have a bounded maintenance
purpose. Non-default string exceptions are registered in
`agent-doc-rules.config.json` under `governance.exceptions` with an exact
`setting`, exact `value`, concrete `reason`, and this decision path.
`duplicateCandidates.ignorePairs` remains empty. Repeated summaries and
entry-point context stay visible as candidates for host-agent review instead of
being hidden by file-pair suppressions.

Phase-specific exclude arrays repeat the shared generated-skill exclusion when
the validator's replacement precedence would otherwise drop it. The shared
`docs.exclude` setting remains its single governance owner.

The remaining non-pair exceptions are:

| Setting | Exact scope | Finding intentionally suppressed |
| --- | --- | --- |
| `docs.exclude` | Generated `.agents/skills/` tree | Duplicate validation of local symlinks and reviewed, locked third-party skill copies. |
| `docs.links.skip` | Reserved `https://example.invalid` URLs | Link failures for deliberately unreachable sample and fixture URLs. |
| `docs.security.exclude` | Security command fail fixture README | Remote script execution, instruction override, secret disclosure, and remote image findings required by the failure scenario. |
| `docs.security.exclude` | Security command pass fixture README | Remote image and tracking-link examples that the scenario-specific config explicitly allows. |
| `docs.duplicateCandidates.exclude` | Retired duplicate-checker changelog | Candidate overlap between immutable package history and current documentation. |
| `docs.duplicateCandidates.exclude` | Prepared E2E project trees | Candidate overlap inside isolated fixture input that the semantic-review workflow excludes by default. |

The duplicate corpus excludes only files below committed E2E `project/` fixture
trees and the one retired-package changelog. E2E maintainer guides, production
documentation, templates, changelogs, and skill files remain in the corpus.

## Trade-Off

The root duplicate scan will not report fixture-to-fixture or
fixture-to-production overlap when the fixture side is inside an E2E `project/`
tree. Either excluded security fixture can also acquire a new finding that the
root security scan will not report. Validation also will not catch a manual
edit made only to a generated `.agents/skills/` copy. Canonical source checks,
skill-sync and install-layout tests, isolated fixture paths, scenario-level
tests, and machine-readable governance reduce those risks but do not remove
them.

## Consequences

- Live external links are checked; only the reserved example host is skipped.
- Generated project-skill copies are outside the root documentation corpus;
  their canonical local sources and locked installation layout are checked.
- Root security validation still scans all Markdown except the two exact
  security fixture README files. Their command E2E scenarios remain responsible
  for the intended fail and pass behavior.
- Historical duplicate-checker release notes and prepared fixture input do not
  add noise to current semantic review.
- Changelogs, E2E maintainer documentation, production summaries, and entry
  points are no longer hidden by duplicate-pair patterns.
- `duplicateCandidates.ignorePairs` stays empty.
- A config exception without a reason and decision link is invalid repository
  governance even if the underlying validator accepts it.

## Applies To

- [`agent-doc-rules.config.json`](../../agent-doc-rules.config.json) owns the
  exact exception values and machine-readable decision links.
- Generated `.agents/skills/` entries are restored from canonical local sources
  or reviewed versions in `skills-lock.json`.
- Prepared fixture projects below `packages/**/e2e/**/project/` are outside the
  production duplicate-review corpus.
- The two security command scenarios verify the excluded security fixture
  behavior directly.

## Backlinks

- Every `governance.exceptions` entry in
  [`agent-doc-rules.config.json`](../../agent-doc-rules.config.json) names this
  record in its `decision` field.

## Revisit When

- Remove an exception when its exact value no longer suppresses a current
  finding.
- Remove the generated-skill exclusion if generated copies become canonical or
  stop being covered by source and install-layout checks.
- Rewrite a fixture and remove its exception when the scenario can test the same
  behavior without copying production prose or unsafe documentation.
- Move durable maintainer documentation out of an E2E `project/` tree before it
  becomes canonical, or narrow the fixture exclusion so the page enters the
  production duplicate corpus.
- Revisit this contract if the validator gains native structured governance for
  link, security, or corpus exclusions.
