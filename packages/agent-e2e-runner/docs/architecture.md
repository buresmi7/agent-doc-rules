# Agent Scenario Architecture

Agent scenarios test a skill through the same surface a user exercises: an
installed skill, a real agent runtime, ordinary user messages, and repository
edits made with agent tools.

## Test Boundary

The system under test includes:

- installation of the dependencies declared by the fixture project;
- skill installation and Codex skill discovery;
- the skill instructions and any references Codex chooses to read;
- one persistent Codex conversation;
- Codex file and command tools inside the fixture project;
- the final project state and user-facing responses.

The runner does not turn project files into a model prompt and does not apply
model-proposed JSON patches. Codex reads and changes the isolated project
itself.

## Conversation Model

The runner trims outer whitespace from each `scenario.json.turns` prompt and
sends the normalized prompts in array order. The first turn starts a Codex
session; later turns use `codex exec resume` with the same session ID. Codex
therefore sees its real prior responses and tool activity instead of a
transcript reconstructed by the runner.

The isolated Codex configuration keeps the agent session in `workspace-write`
mode across resumed turns. The separate judge uses its own `read-only`
configuration.

User turns are still scripted before the run. The runner does not yet choose a
branch based on the exact question Codex asks. Criteria should fail the scenario
when a later reply does not make sense after the actual preceding response.

Each turn stores named criteria beside its prompt. The single judge evaluates
each criterion against the response, activity, and project state captured
immediately after that turn, so later repairs do not hide an earlier failure.

## Isolation

The runner copies the fixture into a unique run directory and gives Codex
`workspace-write` access to that copy. By default, run directories live under
`<scenario>/.agent-e2e-output/`. The CLI can place them under another parent
with `--output-root` or `AGENT_E2E_OUTPUT_ROOT`. The runner omits the fixture's
`node_modules` and installs dependencies inside the isolated project. It uses
the fixture's `packageManager` or lockfile, then the repository setting, and
defaults to npm. It supports npm, pnpm, Yarn, and Bun.

The output root cannot be inside the fixture project. When the fixture contains
the scenario directory, the runner places its default output root next to the
fixture instead. Each run also contains local workspace markers that keep the
dependency installation within the run instead of a parent workspace.

Relative `file:` dependencies are resolved against the source fixture.
Installed `workspace:` dependencies are resolved from the source workspace.
The runner temporarily converts those dependencies to absolute `file:` sources
for installation outside the workspace, then restores `package.json` and its
lockfiles before Codex starts. This lets a local workspace dependency use the
current skill source without changing the fixture.

The runner verifies that `--skill-package` names a fixture dependency, resolves
that installed package, then calls `skills add --copy --skill <name>`. Copying
is a test-isolation choice: Codex receives a fixed installation instead of a
symlink to the editable skill source. It is not part of the Agent Skills
specification.

The runner also adds the fixture's `.agents` directory as an explicit writable
root because Codex otherwise protects that hidden directory. This lets a
tested workflow create project skills without granting unrestricted filesystem
access. The runner removes a fixture-only `test:agent` package script before
the session so the test harness does not leak into project context.

Each scenario receives an isolated `CODEX_HOME`. The runner copies only Codex
authentication, writes a minimal model config, and does not copy user rules or
home-directory instructions. The session is persistent only inside its run
directory. The config treats the fixture manifest and the run workspace file as
project-root markers, so runs inside another repository do not inherit that
repository's `AGENTS.md` files. Authentication is removed before the runner
returns, including when failed output is retained.

The Codex process still inherits the runner environment, and `workspace-write`
limits writes rather than providing container isolation. Run only trusted
skills and fixtures, and do not expose credentials that the tested process
should not receive.

`skills add` may create or update `skills-lock.json`. Before the session starts,
the runner restores that file to its fixture state, including removing it when
the fixture had none. The installed test skill and the fixture's lockfile state
are protected harness inputs. The run fails after the offending turn if the
agent changes them, including through the writable `.agents` root. Symbolic
links are rejected so a fixture or agent cannot make project-state inspection
follow a path outside the isolated project. Project diffs ignore `.git` and
`node_modules`; other generated or build directories remain visible unless the
config excludes them explicitly.

## Evaluation

After the final turn, a separate ephemeral Codex run receives:

- the named criteria from each `scenario.json` turn;
- selected project evidence before and after the session;
- the actual user and agent transcript;
- completed command summaries with exit codes and file-tool operations;
- file changes for each turn and for the full session.

The concise tool audit lets the judge verify claims such as a successful test
or validator run. Shell arguments and command output are not copied into the
judge prompt or snapshots because they can contain fixture values, become
large, and often duplicate project evidence. The retained Codex JSONL is the
full debugging record.

The judge is read-only and does not receive the installed skill source. This
keeps evaluation focused on externally visible behavior instead of asking the
judge to repeat the skill's own claims.

The judge evaluates every declared criterion and returns an exhaustive
`failedCriteria` list. The report marks each listed criterion as failed and
each omitted criterion as passed. A criterion remains not evaluated only when
the run does not produce a valid evaluation.

`CODEX_JUDGE_MODEL` and `CODEX_JUDGE_REASONING_EFFORT` can separate the judge
from the tested agent. Without those overrides, both roles use the configured
Codex model.

## Scenario Record And Report

Every agent run creates `report.json` as soon as its output directory exists.
The runner rewrites the whole document atomically at lifecycle checkpoints and
before and after every conversation turn. Completed turns remain in later
checkpoints. If a later turn or checkpoint fails, the last valid document stays
readable instead of becoming a partially written JSON file.

The versioned document is the source for successful, failed, and interrupted
runs. It contains the normalized prompts sent to the agent and their criteria,
each available response, concise tool activity, per-turn unified file diffs,
the final diff, and the judge result or runtime error. A turn that started but
did not finish has status `incomplete` when the runner can checkpoint that
state; later turns remain `pending`. The root status is `running`, `passed`,
`failed`, or `error`. See the
[report format](../../agent-e2e-report/docs/report-format.md) for the field
contract and path semantics. The dependency-free
`@buresmi7/agent-e2e-report` package owns that contract and its validator. The
runner depends on the format package but has no browser or viewer dependencies.

The separate [static viewer](../../agent-e2e-report-viewer/README.md) loads a
local report through the browser File API. Normal passing cleanup removes the
run directory unless output is retained. Updating snapshots writes the
completed JSON to the scenario snapshot directory. `inspect.project` is
reserved for the retained project path; other configured inspection links must
be repository-relative.

The [format limits](../../agent-e2e-report/docs/report-format.md#default-limits)
define report payload ceilings and whether excess data fails a checkpoint or
records an omitted patch. The retained `project/` directory remains available
when the complete final file is needed.

Judge evidence defaults to 256 KiB per file and 2 MiB in total, with at most
10,000 discovered project files. Project-state capture defaults to 16 MiB per
file, 10,000 files, and 256 MiB in total. These producer limits fail the run;
silently truncating them could hide data from evaluation or diffing.

Passing agent snapshots use the same format in `snapshot/report.json`. A
snapshot is one recorded passing example, while the criteria in
`scenario.json` remain the authoritative expectations. The agent snapshot
directory contains only `report.json`. Refresh refuses unknown entries, writes
the replacement atomically, and removes only known entries from the earlier
snapshot layout. Command stdout and stderr snapshots keep their existing
format.

## Limits

- The agent runner supports Codex only.
- Agent scenarios require a `project/package.json` with the package selected by
  `--skill-package` in its dependencies.
- Project dependency installation may run package lifecycle scripts. Run only
  trusted fixtures and dependencies.
- A `workspace:` dependency must already be resolvable from the source
  workspace. Run the workspace install before its E2E scenarios.
- Skill installation uses `npx` and therefore needs npm registry access.
- The runner does not impose a process timeout. Apply a CI job timeout when a
  stalled Codex or command process must be terminated automatically.
- Model-backed outcomes are nondeterministic; criteria are authoritative and
  snapshots are examples of passing runs.
- User turns are fixed, not conditionally branched.
- One scenario contains at most 16 turns.
- Retained output and snapshots may contain sensitive test data. The
  [format reference](../../agent-e2e-report/docs/report-format.md#project-changes)
  defines the limited safeguards applied to diff payloads. Raw retained JSONL
  also contains command arguments and output. Do not use sensitive fixtures.
- A model judge should not replace deterministic command scenarios for exit
  codes, exact output, required files, or other mechanical checks.
