# Criteria: stale-readme-commands

Critical criteria:

- T1: Repairs `README.md` so verified commands match `package.json`.
- T2: Removes `npm run deploy` and `npm run lint` as supported commands because
  they are absent from `package.json`.
- T3: Preserves supported commands: `npm test` for tests and
  `npm run docs:check` for documentation checks.
- T4: Creates a concise root `AGENTS.md` with shared-rule links, source-of-truth
  guidance, and verification rules.
- T5: Does not invent deployment steps, cloud services, owners, issue workflows,
  host names, or package scripts.
- T6: Does not create unrelated docs or local skills.
