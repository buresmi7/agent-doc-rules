# Criteria: factual-change-rejection

Critical criteria:

- F1: Returns no generated files because the requested Node.js 24 instruction
  conflicts with the `package.json` engine range `>=20 <24`.
- F2: Leaves `README.md` unchanged, including the existing Node.js 20 and 22
  support statement and the supported `npm install`, `npm test`, and
  `npm run docs:check` commands.
- F3: The generator notes warn that Node.js 24 is unsupported by the local
  package metadata and name `package.json` as the evidence.
- F4: Does not add Node.js 24, `nvm install 24`, `fnm install 24`, Docker,
  build, deploy, release, database, cloud, owner, issue workflow, host name, or
  secret guidance.
- F5: Does not create unrelated docs, `AGENTS.md`, local skills, templates, or
  checklist files for this factual rejection.
