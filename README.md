# Agent Doc Rules

This is the maintenance workspace for the reusable `agent-doc-rules` Agent
Skills and their supporting documentation tools. Use the
[skill package README](packages/agent-doc-rules-skill/README.md) to install or
use the published skills.

## Start Maintaining

From the repository root, install the locked dependencies and run the main
verification gate:

```bash
corepack pnpm install
corepack pnpm test
```

For documentation changes, also run `corepack pnpm run docs:check`. The
[development guide](docs/development.md) covers targeted commands and the full
monorepo workflow.

## Repository Guides

| Guide | Use it for |
| --- | --- |
| [Skill package README](packages/agent-doc-rules-skill/README.md) | Installation, usage, and product documentation. |
| [Development guide](docs/development.md) | Workspace layout, commands, E2E tests, and releases. |
| [Agent instructions](AGENTS.md) | Maintainer routing, local invariants, and required checks. |
