---
name: todo-cleaner
description: Use when rough notes or dictated text need to become a clean todo list.
---

# Todo Cleaner

Treat every message that triggers this skill as source material for `TODO.md`;
the user does not need to ask for a todo file explicitly.

## Workflow

1. Read the message, existing `TODO.md`, the local todo style, and relevant
   context about people, dates, and dependencies.
2. Keep existing tasks unless the user clearly removes them. Add only clear,
   confirmed commitments as unchecked tasks in the local style.
3. Keep an item out of `TODO.md` if it conflicts with an existing plan,
   contradicts itself, or leaves a person, date, or condition unclear. Ask one
   direct, answerable question for each such item; describing the ambiguity is
   not a question. For a bare name, search local context and name each match.
4. Apply partial answers, then repeat a direct question for every item that is
   still unresolved. Keep both unresolved items and questions out of `TODO.md`.
5. Drop filler and canceled alternatives; never invent project facts. Edit only
   `TODO.md` unless the user asks for another file change.
