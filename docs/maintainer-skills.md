# Maintainer Skill Sync

This repository publishes one reusable skill: `agent-doc-rules`.

It also installs a project-scoped maintainer skill set into `.agents/skills/`
so agents working in this monorepo can use the same workflow as consuming
projects. Those maintainer skills are local development tools. They are not
part of the published `agent-doc-rules` artifact.

## Sources

| Source | Declared In | Installed By |
| --- | --- | --- |
| Local skill workspace | `packages/agent-doc-rules-skill/package.json` | Symlinked by `tools/sync-project-skills.mjs` |
| npm-compatible skills | `packages/agent-doc-rules-skill/package.json` | Wrapped `skills experimental_sync` |
| GitHub skills | `skills-lock.json` | `skills add <source> --skill <name>` |

Generated copies under `.agents/skills/` are ignored by Git, except for the
`agent-doc-rules` symlink. Commit the manifests and lockfiles, not generated
external skill directories.

## Why There Is A Wrapper

The `skills experimental_sync` command scans `node_modules` in the current
project. With pnpm, dependencies declared by
`packages/agent-doc-rules-skill/package.json` are installed under that workspace
package, not as direct root dependencies.

`tools/sync-project-skills.mjs` bridges that layout:

1. It restores GitHub-sourced skills from `skills-lock.json`.
2. It creates a temporary project.
3. It symlinks the skill package's `node_modules` into that temporary project.
4. It runs `skills experimental_sync` there.
5. It copies only the npm skills listed in
   `agentDocRules.projectSkills` into root `.agents/skills/`.
6. It verifies each copied skill against the hash stored in `skills-lock.json`.
7. It installs `agent-doc-rules` through `skills add`, then replaces the copy
   with a symlink to the workspace package.

This keeps the dependency ownership close to the local skill package while the
root project still gets a normal project-scoped `.agents/skills/` directory.

## Add An npm Skill

Use this path for packages that contain `SKILL.md` files and are discoverable by
`skills experimental_sync`.

1. Add the package to
   `packages/agent-doc-rules-skill/package.json` under `devDependencies`.
2. Add each skill to install under `agentDocRules.projectSkills`:

   ```json
   {
     "name": "example-skill",
     "source": "example-skill-package"
   }
   ```

3. Generate or refresh the lock entry in a temporary project:

   ```bash
   tmp=$(mktemp -d)
   cd "$tmp"
   npm init -y
   npm install --ignore-scripts example-skill-package
   npx -y skills@1.5.12 experimental_sync -a codex -y
   cat skills-lock.json
   ```

4. Copy the selected skill entry into root `skills-lock.json` with:
   - `source` set to the npm package name,
   - `sourceType` set to `node_modules`,
   - `computedHash` copied from the generated lockfile.
5. Run:

   ```bash
   corepack pnpm install
   corepack pnpm run skills:sync
   corepack pnpm run test:install
   corepack pnpm test
   ```

Review the generated `.agents/skills/<name>/SKILL.md` before relying on the
skill. External skills run with full agent permissions.

## Add A GitHub Skill

Use this path for skills that are not published as npm-compatible packages.

1. Install the skill directly once from the repository root:

   ```bash
   npx -y skills@1.5.12 add <owner>/<repo> --skill <name> -a codex -y --copy
   ```

2. Review the generated `.agents/skills/<name>/SKILL.md`.
3. Keep the generated `skills-lock.json` entry.
4. Run:

   ```bash
   corepack pnpm run skills:sync
   corepack pnpm run test:install
   corepack pnpm test
   ```

## Update An External Skill

1. Reinstall or resync the candidate update.
2. Review the changed generated skill files.
3. Update `skills-lock.json` only after accepting the new behavior and hash.
4. Run the validation commands from the relevant add flow.

If the wrapper reports a hash mismatch, treat it as an intentional review gate.
Do not update the hash until the new upstream skill content has been inspected.
