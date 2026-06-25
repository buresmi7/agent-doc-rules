# Factual Documentation Review

Use this reference when reviewing repository docs for factual accuracy,
contradictions, unsupported claims, stale facts, or misleading precision.

## Review Scope

Review claims that a maintainer or reader could act on:

- commands, scripts, package managers, and setup steps,
- files, paths, modules, generated artifacts, and configuration names,
- dependencies, integrations, services, hosts, runtimes, and version claims,
- supported workflows, release steps, deployment steps, and ownership rules,
- dates, compatibility statements, guarantees, and broad capability claims.

Do not treat style preferences, intent statements, or roadmap language as false
facts unless the wording presents them as current behavior.

## Evidence Rules

Use the strongest available evidence before making a finding:

1. The user's explicit constraints for this task.
2. Executable local evidence, such as a command that succeeds or fails.
3. Repository manifests, source files, config, tests, lockfiles, and generated
   files.
4. Canonical documentation inside the repository.
5. Official external sources for facts that depend on current external
   behavior.
6. No evidence found.

Treat absence of local evidence carefully. A missing `package.json` script can
disprove a documented `npm run <name>` command. A missing dependency does not by
itself prove that a service is unused unless the claim depends on that
dependency.

When a fact may have changed outside the repository, verify it with official
sources or mark it as `stale-risk`. Do not present a guess as a confirmed
finding.

## Detection Pass

Make one pass over the relevant docs and collect claims. Then compare each claim
against evidence:

- Compare documented commands with manifests before preserving them.
- Check that named files, folders, scripts, config keys, and generated outputs
  exist or are clearly examples.
- Compare repeated claims across README files, `AGENTS.md`, docs, templates, and
  skill references.
- Flag broad claims such as "all", "always", "fully supported", and
  "production-ready" when the repository only supports a narrower statement.
- Flag precise version, date, support, or compatibility claims when the evidence
  is missing or likely stale.
- Check whether technically true wording could still lead a reader to the wrong
  action.

## Finding Types

Use these labels consistently:

- `false`: Evidence contradicts the claim.
- `contradiction`: Two repository docs cannot both be true.
- `unsupported`: The claim might be true, but the repository does not support
  it.
- `misleading`: The claim is technically defensible but likely to send the
  reader toward the wrong action.
- `stale-risk`: The claim depends on changing external facts and has not been
  verified.
- `overclaim`: The wording is broader or more certain than the evidence allows.

## Severity

- `fail`: A reader would run the wrong command, edit the wrong file, rely on a
  nonexistent workflow, or accept a direct contradiction.
- `warn`: The claim is unsupported, stale-prone, or too broad, but the safe
  correction needs maintainer judgment.
- `note`: The wording can be clearer or less precise, but the risk is low.

## Report Format

Lead with findings, ordered by severity. Use this structure for each finding:

```text
- [fail|warn|note] path/to/file.md:line - Short issue
  Type: false|contradiction|unsupported|misleading|stale-risk|overclaim
  Claim: The documented claim under review.
  Evidence: The repo or external evidence used.
  Impact: What a reader would get wrong.
  Fix: Remove, narrow, verify, or replace the claim.
  Confidence: confirmed|likely|needs maintainer confirmation
```

If there are no findings, say that directly and list the checks performed. If a
check could not run, state the reason and the remaining risk.

## Repair Rules

When editing instead of only reviewing:

- Do not apply a requested documentation change when local evidence contradicts
  it. Return a finding instead.
- Preserve verified project-specific facts.
- Remove false claims instead of replacing them with invented details.
- Narrow overclaims to match the evidence.
- Mark examples as examples when they are not supported project commands.
- Link to the canonical source instead of copying conflicting text.
- Keep uncertain claims out of durable docs unless the user confirms them.
