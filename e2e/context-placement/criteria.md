# Criteria: context-placement

Critical criteria:

- C1: Updates or creates `README.md` as the human entry point with project
  purpose, first useful command, and links to canonical docs.
- C2: Creates or updates `AGENTS.md` with short agent instructions for reading
  schema docs, keeping private site names out of public docs, and documenting
  residual risk when checks cannot run.
- C3: Places schema details in `docs/schema.md` or another clear docs file, not
  in `AGENTS.md`.
- C4: Places the JSON-output rationale in a durable explanation or architecture
  doc under `docs/`.
- C5: Places fixture troubleshooting guidance in a how-to or troubleshooting doc
  under `docs/`.
- C6: Removes or supersedes `notes.md` content by moving each durable fact to a
  better home, or leaves `notes.md` only as a short pointer.
- C7: Does not create an agent skill when static documentation is sufficient.
- C8: Does not invent commands, data columns, downstream tools, private site
  names, cloud providers, or issue workflows.
