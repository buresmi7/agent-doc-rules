# Agent Doc Rules

Reusable documentation and `AGENTS.md` rules for AI-assisted repositories.

`agent-doc-rules` gives teams a small, versioned baseline for repository
instructions, documentation architecture, and local project overlays. It is for
projects that want consistent AI-agent behavior without copying long rule blocks
between repositories.

## Why This Exists

AI agents work better when repository instructions are short, stable, and easy
to route from. The problem is that those instructions often grow into repeated
walls of process text across `AGENTS.md`, skills, templates, and project docs.

This library keeps the reusable parts in one place:

- how to structure `AGENTS.md`,
- where documentation rules should live,
- how to avoid duplicated agent instructions,
- how to separate shared rules from local project overrides.

Projects vendor a released snapshot, then add their own local rules on top.

## What Is Included

```text
rules/
  agents-md.md
  documentation-architecture.md

templates/
  AGENTS.project.md
  AGENTS.overlay.md
```

| Path | Purpose |
| --- | --- |
| `rules/agents-md.md` | Rules for concise `AGENTS.md` files that link to deeper docs. |
| `rules/documentation-architecture.md` | Canonical homes for rules, references, templates, and always-loaded docs. |
| `templates/AGENTS.project.md` | Starter root `AGENTS.md` for a consuming repository. |
| `templates/AGENTS.overlay.md` | Starter local override file for project-specific constraints. |

## What Is Not Included

This repository deliberately does not contain:

- project-specific workflows,
- issue lifecycle commands,
- task manager or worktree conventions,
- forge, cloud, deployment, or runtime commands,
- secrets, account IDs, host names, or private environment notes,
- copied vendor tutorials.

Keep those in the consuming project.

## Install In A Project

Consume this repository as a committed snapshot. This keeps always-on agent
rules available offline and avoids submodule or package-manager setup.

1. Choose a release tag, for example `v0.1.6`.
2. Copy the released `rules/` and `templates/` directories into the consuming
   project:

   ```text
   agent-rules/shared/
     VERSION
     rules/
     templates/
   ```

3. Record the source version:

   ```text
   agent-doc-rules v0.1.6
   ```

4. Create or update the project root `AGENTS.md`:

   ```markdown
   ## Shared Rules

   - [AGENTS.md rules](agent-rules/shared/rules/agents-md.md)
   - [Documentation architecture](agent-rules/shared/rules/documentation-architecture.md)

   ## Local Overrides

   - Persisted project artifacts are written in Czech.
   - This local rule overrides the shared core.
   ```

5. Remove duplicated prose from the project `AGENTS.md`; keep only local
   invariants, links, and explicit overrides.

## Update A Project Snapshot

When a new release is available:

1. Compare the release diff.
2. Replace the vendored `agent-rules/shared/rules/` and
   `agent-rules/shared/templates/` directories.
3. Update `agent-rules/shared/VERSION`.
4. Review local overlays and remove rules that are now covered by the shared
   core.
5. Check local Markdown links.

## Publishing Model

This repository is published through GitHub tags and releases:

- release tags use `vMAJOR.MINOR.PATCH`,
- release notes summarize rule and template changes,
- consumers update snapshots intentionally,
- `master` can move ahead of the latest release, but projects should vendor
  from tags.

The repository itself is the source of truth. GitHub topics, releases, and the
README make it discoverable; consuming projects should not depend on live remote
links at runtime.

## Repository Health Checklist

For a public release, keep these current:

- clear README,
- MIT license,
- GitHub description and topics,
- release tag and GitHub Release,
- changelog entry,
- no project-specific or private environment details in shared rules.

## Validation

Run the static checks before publishing a release:

```bash
npm test
```

Static checks run Markdown linting, offline local link checks, and a small npm
audit gate. `npm run test:static` is an equivalent explicit command.

The repository also includes a prepared agent E2E harness:

```bash
npm run test:agent
```

That harness imports the library into temporary projects, asks Codex to create
or repair `AGENTS.md`, then asks Codex to judge the result against scenario
criteria. It uses `codex exec` by default and expects the local Codex CLI to be
installed and authenticated.

Use `CODEX_MODEL` when you want to pin the model used by the harness:

```bash
CODEX_MODEL=gpt-5-codex npm run test:agent
```

Each agent E2E scenario lives under `test/scenarios/<name>/` with its input
fixture, criteria, and example passing snapshot together. Refresh snapshots
after an intentional prompt or criteria change:

```bash
UPDATE_AGENT_SNAPSHOTS=1 npm run test:agent
```

If an Ollama-compatible local model is available, the same harness can be run
through the explicit Ollama runner:

```bash
AGENT_TEST_RUNNER=ollama OLLAMA_MODEL=qwen2.5:3b npm run test:agent
```

The agent E2E test is intentionally separate from the default release checks
because it depends on an authenticated agent or a configured local model.

The audit gate accepts the current moderate dev-tooling advisories in
`markdownlint-cli2` and its transitive dependencies because this repository does
not ship runtime JavaScript. New or higher-severity findings fail the check.

The old deterministic content check was intentionally replaced by this E2E
test. The main value of the library is whether imported rules help an agent
produce or repair a good project `AGENTS.md`.

## Maintainers

Maintained by the repository owner. Use GitHub issues for concrete bugs,
improvements, and rule/template proposals.
