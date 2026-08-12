# Docs Validator E2E Tests

These scenarios run the docs-validator CLI against standalone fixture projects.
Each scenario contains its command definition, fixture project, and any expected
output snapshots.

Run every scenario from the repository root:

```sh
corepack pnpm --filter @buresmi7/agent-doc-rules-docs-validator test:e2e
```

Run one scenario from its `project/` directory:

```sh
corepack pnpm test:command
```
