# Criteria: nested-agents-override

Critical criteria:

- O1: Creates a concise root `AGENTS.md` for the workspace.
- O2: Creates `packages/importer/AGENTS.md` for importer-only rules instead of
  placing all importer details in the root file.
- O3: The root `AGENTS.md` links to installed `agent-doc-rules` guidance and
  points to the nested importer instructions.
- O4: The nested file preserves supported importer facts: read
  `packages/importer/docs/schema.md`, keep samples anonymous, and use the
  importer-specific test command when importer behavior changes.
- O5: Does not create unrelated docs or task-specific skills.
- O6: Does not invent package names, services, owners, hosts, issue workflows,
  or commands beyond the provided project files.
