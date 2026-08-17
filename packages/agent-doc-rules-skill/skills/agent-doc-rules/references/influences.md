# Influences And Attribution

This skill uses original wording and repository-specific rules, but its design
draws on established documentation and agent-skill practices.

## Agent Skill Structure

The skill layout follows the open Agent Skills pattern:

- a short `SKILL.md` entry point,
- progressive disclosure through `references/`, `assets/`, and optional
  scripts,
- task-specific context loaded only when needed.

Influences:

- [Agent Skills specification](https://agentskills.io/specification)
- [Anthropic Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

## Documentation Architecture

The document-type split in `writing-style.md` follows the Diataxis idea that
documentation should separate tutorials, how-to guides, reference, and
explanation because those forms answer different reader needs.

Influences:

- [Diataxis](https://diataxis.fr/)
- [Diataxis in five minutes](https://diataxis.fr/start-here/)

## Plain English

The plain-English rules follow the long-running technical-writing tradition of
short words, concrete nouns, active voice, and cutting padding. The local rules
adapt those principles for repository documentation and AI-generated prose.

Influences:

- [George Orwell, "Politics and the English Language"](https://www.orwellfoundation.com/the-orwell-foundation/orwell/essays-and-other-works/politics-and-the-english-language/)
- [Ernest Gowers, "The Complete Plain Words"](https://plain-words.com/)

## Public Skills Reviewed

The repository also reviewed public skills to understand common patterns for
documentation writing, plain-English cleanup, skill authoring, and project
skill management. The final `agent-doc-rules` skill does not vendor those
skills; it keeps a smaller local rule set tailored to repository documentation
and agent context architecture.

Useful references included:

- [anthropics/skills](https://github.com/anthropics/skills)
- [docmd-io/docmd-skills](https://github.com/docmd-io/docmd-skills)
- [github/awesome-copilot](https://github.com/github/awesome-copilot)
- [b1rdmania/claude-plain-english-skill](https://github.com/b1rdmania/claude-plain-english-skill)

## Local Meta-Work Workflow

The documentation duplicate-check model comes from the earlier `meta-work`
maintenance workflow: run deterministic Markdown and link checks first, then
review only duplicate candidates with an agent. The published skill keeps that
separation so routine validation stays cheap and semantic review remains
explicit.
