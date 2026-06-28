# Documentation Security Review

Use this reference when reviewing `AGENTS.md`, skills, README files, templates,
and repository docs for instructions that could make an agent leak data, weaken
security, or create intentional defects.

Treat agent-facing documentation as executable influence. A short sentence in a
skill or `AGENTS.md` can change how an agent edits code, handles secrets, or
reports work.

## Review Targets

Look at always-loaded and agent-routed content first:

- `AGENTS.md` and nested overrides,
- `.agents/skills/**/SKILL.md` and skill references,
- starter templates and generated instruction examples,
- README setup commands and copied troubleshooting steps,
- docs that agents are told to read before editing.

## High-Risk Patterns

Reject instructions that ask an agent to send repository data, logs, secrets,
environment values, source files, or command output to an external service.

Block install or setup snippets that execute remote code without a reviewed
package boundary. Prefer pinned package-manager installs, local scripts, or
links to human-run documentation.

Reject instructions that ask an agent to print, paste, upload, or summarize
tokens, keys, credential files, cookies, customer records, private host names,
or account identifiers.

Reject prompt-injection language that conflicts with higher-priority
instructions, hides changes from the user, avoids reporting risky edits, or
keeps working after a policy or permission conflict.

Flag text that tells the agent to bypass tests, linting, documentation checks,
security checks, pre-commit hooks, permission errors, or review gates.

Reject examples that normalize fail-open behavior, hidden admin access, debug
backdoors, disabled authentication, disabled authorization, disabled input
validation, disabled TLS validation, or weakened rate limits.

Flag remote images, badges, pixels, tracking links, and analytics URLs in
reusable docs. They can leak reader metadata and make documentation depend on an
external service.

Flag encoded payloads, obfuscated shell snippets, and long opaque blobs. A
maintainer should not need to decode hidden instructions to review docs.

## Review Method

1. Start with the most authoritative files: root `AGENTS.md`, skill entry
   points, and templates.
2. Check every command block for network access, install behavior, and secret
   handling.
3. Check prose for instructions that change agent behavior, not only code
   snippets.
4. Compare new rules against canonical docs. A local override should narrow a
   rule for a real project need, not replace a safety rule.
5. If a risky pattern is intentional test fixture content, keep it isolated and
   add an explicit validator allow pattern for that fixture.

## Deterministic Check

Use `agent-doc-rules-docs security` for the built-in deterministic scan. It is a
first pass, not a full review. It looks for high-risk shell snippets, secret
disclosure instructions, prompt-injection wording, validation bypasses,
backdoor-style guidance, remote images, tracking links, and encoded execution
payloads.

When the scanner reports a false positive, prefer rewriting the example so it
does not look like a real instruction. If the risky text must stay, add a narrow
`docs.security.allow` pattern and explain why the fixture needs it.
