# Criteria: create-agent-skill-from-workflow

Critical criteria:

- W1: Creates a task-specific skill under `.agents/skills/` for the repeated
  release-note drafting workflow.
- W2: The new skill has a valid `SKILL.md` with frontmatter `name` and
  `description`, a short workflow, and clear trigger boundaries.
- W3: The new skill tells the agent to read `CHANGELOG.md` and
  `docs/release-input.md`, group changes into Added, Changed, Fixed, and
  Removed, and write `docs/releases/<version>.md`.
- W4: The new skill preserves the privacy rule: do not publish customer names or
  private issue links.
- W5: The README becomes a concise human entry point and links to the new skill
  instead of carrying the full agent workflow.
- W6: Creates or updates `AGENTS.md` only as a short routing layer, not a copy
  of the release-note workflow.
- W7: Does not invent changelog entries, release versions, private links,
  release tools, hosting systems, or issue trackers.
- W8: Uses `references/` or `assets/` inside the new skill only if they reduce
  duplication or keep `SKILL.md` concise.
