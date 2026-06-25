# Harbor Backup Notes - AI Agent Instructions

Harbor Backup Notes is documentation-only. It records human maintainer notes for
staging SQLite backup restores used during local documentation checks.

## Skill Reference

- [AGENTS.md rules](.agents/skills/agent-doc-rules/references/agents-rules.md)
- [README rules](.agents/skills/agent-doc-rules/references/readme-rules.md)

## Local Rules

- Keep the human restore runbook in `docs/staging-sqlite-restore.md`.
- Do not copy the full restore procedure into `AGENTS.md` or generated agent
  guidance.
- Do not paste real customer data into examples or generated documentation.

## Source Of Truth

| Document | Content |
| --- | --- |
| `README.md` | Project overview and canonical docs index |
| `docs/staging-sqlite-restore.md` | Human staging SQLite restore runbook |
| `package.json` | Available npm scripts |

## Verification

For documentation changes, run:

```bash
npm run docs:check
```

If a check cannot run, state the blocker and the remaining risk.
