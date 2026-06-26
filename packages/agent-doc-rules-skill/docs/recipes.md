# Recipes

These recipes mirror the behavior protected by the agent E2E scenarios in this
repository. Use them as examples when applying `agent-doc-rules` to another
project.

## Create Basic Agent Instructions

Prompt:

```text
Use $agent-doc-rules to create a concise root AGENTS.md for this repository.
```

Expected result:

- the file starts with a short project orientation,
- shared rules are linked instead of copied,
- local source-of-truth docs are named,
- verification commands come from local manifests or existing docs.

## Leave Compliant Docs Alone

Prompt:

```text
Use $agent-doc-rules to review this repository's docs and repair problems.
```

Expected result:

- no file changes when the docs already satisfy the rules,
- a short note naming the checks or evidence used.

This protects repositories from style-only churn.

## Split A Bloated README

Prompt:

```text
Use $agent-doc-rules to trim this README and move long-lived detail to the right docs.
```

Expected result:

- README follows [`readme-rules.md`](../references/readme-rules.md),
- architecture, operations, and troubleshooting move into `docs/`,
- stale or unsupported commands are removed.

## Place Notes In Canonical Homes

Prompt:

```text
Use $agent-doc-rules to triage notes.md into README, docs, AGENTS, or a project skill.
```

Expected result:

- human orientation moves to README,
- rationale moves to an explanation or architecture doc,
- agent-only routing moves to `AGENTS.md`,
- repeated agent workflows become task-specific skills,
- the note inbox no longer carries duplicated durable facts.

## Reject Unsupported Documentation Changes

Prompt:

```text
Use $agent-doc-rules to update the README with the new supported Node.js version.
```

Expected result when local evidence disagrees:

- no unsupported edit is applied,
- the response names the conflicting manifest, config, source file, or doc,
- the maintainer gets the smallest needed fix path.

## Add Nested Agent Overrides

Prompt:

```text
Use $agent-doc-rules to add directory-specific rules for the importer package.
```

Expected result:

- root `AGENTS.md` points to the nested file,
- nested `AGENTS.md` contains only directory-specific rules,
- root instructions do not copy nested details.

## Preserve Local Language Rules

Prompt:

```text
Use $agent-doc-rules to rewrite these docs in the repository's required language.
```

Expected result:

- persisted docs use the language required by the repository,
- file paths, commands, package names, and code identifiers stay unchanged,
- the rewrite does not add generic setup or deploy steps.

## Move Human Runbooks To Docs

Prompt:

```text
Use $agent-doc-rules to clean up this README and AGENTS.md.
```

Expected result when the project has a human procedure:

- the full runbook moves to a `docs/` how-to,
- README links to the how-to,
- `AGENTS.md` keeps only routing, constraints, and checks,
- no project skill is created unless the workflow is specifically for agents.

## Redact Sensitive Notes

Prompt:

```text
Use $agent-doc-rules to move useful facts from notes.md into durable docs.
```

Expected result:

- safe durable facts move to canonical homes,
- customer names, emails, account IDs, private hosts, and tokens are not copied,
- the resulting docs name sensitive categories instead of example values.
