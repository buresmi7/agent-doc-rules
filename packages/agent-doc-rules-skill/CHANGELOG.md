# Changelog

## 0.11.0 - 2026-07-24

- Added an always-loaded rule that keeps prompts, replies, agent narration,
  tool traces, chat metadata, and session-specific paths out of durable
  documentation.
- Preserved supported project facts, requirements, rationale, and confirmed
  decisions while allowing raw conversation only in explicit transcripts or
  conversation examples.
- Required bare lists when evidence supplies only names and rejected inferred
  meanings, mappings, cardinality, causes, and downstream behavior.

## 0.10.0 - 2026-07-21

- Required README and plain-English rewrites to preserve supported project
  facts when a checkout cannot independently verify them.
- Required documentation-only work to leave manifests, source, tests, and
  product contracts unchanged when local evidence contradicts a requested
  claim.
- Treated workflow extraction as relocation: agents create the skill and its
  routing link without also running the extracted release, migration, or other
  workflow.
- Added Markdown formatting guidance and stronger rules for preserving local
  README and `AGENTS.md` constraints.

## 0.9.0 - 2026-07-14

- Added decision-record guidance and a starter template for accepted
  trade-offs, rule exceptions, user-approved shortcuts, and lasting validation
  suppressions.
- Required active decision records to be linked from affected code,
  configuration, documentation, or agent instructions.
- Added a shortcut quality gate that requires the trade-off, consequences,
  remaining risk, repair path, and explicit user confirmation before an agent
  takes a knowingly weaker path.
- Required edited root `AGENTS.md` files to keep project orientation and a
  dedicated shared-rule link.

## 0.8.2 - 2026-06-28

- Updated installation and validation guidance to use the public npm names for
  the documentation validator and duplicate checker.

## 0.8.1 - 2026-06-28

- Published the skill on npm for the first time.
- Normalized the npm binary path so publication no longer needed an automatic
  metadata correction.
- Clarified that even short rationale belongs in a durable explanation or
  architecture document.

## Pre-publication history

`@buresmi7/agent-doc-rules-skill` first appeared on npm at `0.8.1`. The entries
below record the private skill package and the repository content that preceded
it. They were not npm publications under the current package name.

### Repository v0.8.0 - 2026-06-28

- Renamed the package for public npm use and added the
  `agent-doc-rules-skill` installer.
- Added project-scoped installation and replacement commands while keeping the
  installed artifact separate from monorepo support files.
- Documented deterministic security checks and narrow semantic-duplicate
  exclusions alongside the optional validation tools.

### Repository v0.7.0 - 2026-06-28

- Added documentation security guidance for high-risk commands, secret
  disclosure, prompt injection, validation bypasses, backdoors, remote images,
  tracking links, and encoded payloads.
- Added security configuration and usage guidance to the adoption, recipe,
  tool-map, and validation docs.

### Repository v0.6.0 - 2026-06-26

- Added adoption, tool-map, configuration, and recipe documentation.
- Added writing-style guidance that favors direct workflow names and plain
  English.
- Required moved README runbooks to recheck commands in their new location
  rather than preserve unsupported steps.
- Clarified shared-rule placement and allowed supported local skipped-check
  wording to remain unchanged.

### Repository v0.5.0 - 2026-06-25

- Added factual documentation review for false, contradictory, unsupported,
  stale, misleading, and overbroad claims.
- Prevented README rewrites from adding generic setup or package-manager steps
  without evidence.
- Routed rationale to durable explanation docs and required root `AGENTS.md`
  files to preserve project orientation and nested-rule pointers.
- Kept sensitive values out of generated docs while preserving the supported
  categories that maintainers must avoid.

### Repository v0.4.0 - 2026-06-25

- Made the package README the main product guide.
- Added the `AGENTS.md` review rubric and documentation-audit workflow.
- Split the detailed context-placement guide from the shorter documentation
  architecture rules.
- Tightened the skill boundary for nested agent rules, human runbooks, verified
  README commands, no-op reviews, and agent workflow extraction.

### Repository v0.3.0 - 2026-06-24

- Added guidance for using a repository's `docs:check` command.
- Documented the shared validation configuration and the boundary between
  deterministic checks and Codex-assisted review.

### Repository v0.2.0 - 2026-06-24

- Converted the earlier vendored rules and templates into a standard Agent
  Skill workspace package.
- Added the package README, context-placement guide, plain-English writing
  rules, source attributions, and OpenAI skill metadata.

### Repository v0.1.3 - 2026-06-17

- Removed optional maintainer-skill recommendations and updated tagged install
  examples.

### Repository v0.1.2 - 2026-06-17

- Removed Notion-specific maintainer-skill recommendations and updated tagged
  install examples.

### Repository v0.1.1 - 2026-06-17

- Expanded installation, update, publication, and maintenance guidance.
- Added recommended public Codex skills for documentation-library maintainers.

### Repository v0.1.0 - 2026-06-17

- Added the initial documentation architecture and `AGENTS.md` maintenance
  rules.
- Added project and overlay templates and documented snapshot-based
  consumption.
