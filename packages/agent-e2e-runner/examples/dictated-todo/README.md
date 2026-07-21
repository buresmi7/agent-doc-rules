# Dictated Todo Example

This example tests a local skill that turns rough dictation into a useful todo
list without guessing through conflicts or similar names.

The fixture contains an existing `TODO.md`, a formatting guide, and two people:
Jane A., the user's spouse, and Jane B., the user's secretary. The first user
turn asks for several tasks in one dictated message. Some are clear, while
others conflict with the existing todo or need more context.

The five turns exercise one real Codex conversation:

1. The user dictates a dentist appointment, printer toner, `Call Jane.`, and two
   possible launch-email dates.
2. The user resolves Jane and the launch email but leaves the dentist open.
3. The user moves the dentist away from an existing haircut.
4. The user asks for flowers for Jane without saying which Jane.
5. The user confirms Jane A. with a reminder of why Jane B. would be awkward.

Run the scenario from this directory:

```bash
npx agent-e2e-runner agent --scenario e2e/messy-dictation \
  --skill-package @agent-e2e-example/todo-cleaner \
  --skill todo-cleaner
```

The fixture's `package.json` declares `skills/todo-cleaner/` as a local package
dependency. The CLI flags select its `todo-cleaner` skill. The runner installs
the fixture dependencies, adds an isolated copy of that skill, and sends each
prompt from `scenario.json` to the same Codex session. Codex edits `TODO.md`
with its normal tools. The runner records each response and file diff, then
checks every step against the named criteria beside that prompt.

This catches failures that reading `SKILL.md` cannot:

- the skill may not trigger for an ordinary dictated message;
- the agent may overwrite existing tasks;
- the agent may guess which Jane the user means;
- the agent may write unresolved questions into `TODO.md`;
- a later clarification may not update the earlier result correctly.

The source fixture remains unchanged, so the same interaction can run again or
in CI.
