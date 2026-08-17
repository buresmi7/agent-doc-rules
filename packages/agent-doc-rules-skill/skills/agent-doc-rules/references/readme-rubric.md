# README Review Rubric

Use this rubric to review a generated or edited `README.md`.

## Critical Criteria

- **Purpose:** The first section clearly says what the repository is and who
  should use it.
- **Truthfulness:** Commands, paths, integrations, and technologies are present
  only when supported by the repository.
- **Source of truth:** Canonical docs are linked instead of copied.
- **Proportionality:** The README is no larger than the project needs.
- **Actionability:** A new contributor can find the first useful action.
- **Verification:** The README names relevant checks or states that no check is
  known.
- **Plain English:** The README uses direct, concrete language and avoids
  generic AI or marketing phrasing.
- **Safety:** Secrets, credentials, account IDs, private hosts, and sensitive
  environment values are absent.
- **No placeholders:** Empty template sections and fake badges are removed.

## Scoring Guidance

- **Pass:** All critical criteria pass. Minor wording issues are acceptable.
- **Review:** One non-critical section is vague, stale, or too long.
- **Fail:** Any critical criterion fails, or the README invents project facts.

## Reviewer Questions

Ask these questions before accepting the change:

- Does the opening paragraph match the actual repository?
- Are quick-start commands executable in the documented environment?
- Is any detail duplicated from `AGENTS.md`, `rules/`, skills, or deeper docs?
- Would a project-specific detail be better placed in a nearby README, runbook,
  or reference file?
- Does the README link to deeper docs before it becomes a long manual?
- Could any sentence be shorter without losing meaning?
