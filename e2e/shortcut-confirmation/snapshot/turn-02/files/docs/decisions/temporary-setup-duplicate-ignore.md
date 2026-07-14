# Temporary Setup Duplicate Ignore

The pilot branch needs a narrow duplicate-doc workaround so the documentation
review can proceed without the full setup cleanup.

The duplicate check temporarily ignores repeated setup steps between `README.md`
and `docs/setup.md`. This stops the duplicate-doc review from reporting that
specific pair while the exception remains.

Risk: the setup steps in `README.md` and `docs/setup.md` can drift further apart
without the duplicate check catching the drift.

Repair path: move the repeated setup steps into one canonical getting-started
page, then link to that page from `README.md` and `docs/setup.md`. Remove the
`ignorePairs` entry after that cleanup lands.
