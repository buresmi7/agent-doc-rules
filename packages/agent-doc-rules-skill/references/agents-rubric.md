# AGENTS.md Review Rubric

Use this rubric to review a generated or repaired `AGENTS.md`.

## Critical Criteria

- **Purpose:** The opening identifies the repository and what agents must know
  before changing it.
- **Routing:** The file points to canonical docs, shared rules, and local skills
  instead of repeating their details.
- **Local facts:** Local language, safety, verification, and workflow rules are
  preserved when supported by repository files.
- **Concision:** The file stays short enough to scan and avoids full procedures,
  architecture essays, and command references.
- **Source of truth:** Canonical files are linked, and conflicts name the file
  that wins.
- **Verification:** Required checks are named, and skipped checks require a
  reason plus remaining-risk note.
- **Truthfulness:** Commands, tools, hosts, issue workflows, and services are not
  invented or carried forward when unsupported.
- **Safety:** Secrets, credentials, account IDs, customer data, private hosts,
  and environment-specific notes are absent.
- **No shared-rule copies:** Installed shared rules are linked, not pasted into
  the project file.

## Scoring Guidance

- **Pass:** All critical criteria pass. Minor wording or ordering issues are
  acceptable.
- **Review:** One non-critical section is vague, stale, or too long.
- **Fail:** Any critical criterion fails, or the file invents project facts.

## Reviewer Questions

Ask these questions before accepting the change:

- Could a new agent find the relevant docs and checks in the first scan?
- Is any rule copied from `.agents/skills/agent-doc-rules/references/`?
- Does each local rule come from the repository or the user's explicit request?
- Should any long procedure move to `docs/`, `references/`, or a task-specific
  skill?
- Are nested `AGENTS.md` files a better home for directory-specific rules?
- Is every verification command supported by the repository or clearly labeled
  as manual or unavailable?
