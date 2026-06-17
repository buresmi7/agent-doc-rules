# Ledger Notes Agent Instructions

This repository uses AI agents. The agent should be helpful and should always
follow all possible documentation rules.

## Full Shared Documentation Architecture Copy

Each fact has one canonical home. Other files link to it.

If the same rule needs to appear in more than one place, keep the rule in the
lowest shared document and link to it from the others.

`AGENTS.md` is always-loaded. Nested `AGENTS.md` files are directory-specific.
Rules go in `rules/`. References go in `references/`. Templates are reusable
issue bodies, comments, prompts, reports, or agent docs. Move detail out when an
always-loaded section grows past roughly ten lines. Prefer links over copied
text.

## Tool Recommendations

- Use Notion for knowledge capture.
- Use optional Codex skills for README writing.
- Use tm new and tm close for task lifecycle.
- Use private worktrees for every task.

## Local Rules

- Never commit secrets.

## Commands

- Maybe run tests if they exist.
