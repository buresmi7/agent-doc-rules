# Documentation Writing Style

Use this rule when drafting, rewriting, or reviewing repository documentation.

## Core Rule

Write for the next person trying to use or maintain the project. Prefer plain,
specific language over broad claims, slogans, or process commentary.

## Document Shape

Choose the shape that matches the reader's task:

- **Tutorial:** teach a first successful path. Keep choices low.
- **How-to:** solve one concrete task. Start from the goal and list the steps.
- **Reference:** describe commands, options, files, APIs, or contracts.
- **Explanation:** explain why the system works this way and what trade-offs it
  makes.

Do not mix shapes casually. A how-to should not become an architecture essay,
and a reference page should not hide required setup in prose.

## Plain English Rules

- Start with the useful fact. Avoid throat-clearing introductions.
- Use active voice when the actor matters.
- Use concrete nouns and verbs. Prefer "run", "write", "read", "copy", and
  "check" over abstract verbs.
- Keep paragraphs short. One paragraph should usually make one point.
- Cut words that do not change the meaning.
- Prefer direct names for files, commands, and concepts.
- Explain necessary terms at the first use when the target reader may not know
  them.
- Keep examples close to the rule they demonstrate.
- Name workflows by the action or decision they support. Avoid idiomatic or
  metaphorical labels such as "polish pass"; use direct names such as "cleanup
  review", "install check", or "release verification".

## Repository Documentation Rules

- Say what is true in this repository, not what is generally true.
- Document commands only after verifying them or marking them as examples.
- During plain-English rewrites, keep the supported workflow intact instead of
  adding common setup, install, deploy, or package-manager steps.
- Put long setup, release, and troubleshooting procedures in a detailed doc and
  link to it.
- Keep local policy in `AGENTS.md`; keep human orientation in `README.md`.
- Link to the canonical source instead of copying the same rule into several
  files.
- Preserve the consuming repository's required language. When there is no local
  override, use English.

## What To Avoid

- Marketing claims that do not help someone operate the project.
- Generic AI phrasing such as "unlock", "seamless", "robust", "leverage", or
  "comprehensive" when a plainer word works.
- Workflow names that sound clever but do not explain the task.
- Long preambles that explain what the document will do before doing it.
- Summary endings that repeat the section instead of giving a next action.
- Three-part lists created only for rhythm.
- Passive voice that hides who must do the work.
- Placeholder sections, fake badges, future promises, and invented workflows.

## Review Pass

Before accepting documentation, check:

- Can a reader tell what this file is for in the first few lines?
- Does each section have one clear job?
- Are commands, paths, and tool names accurate for this repository?
- Did the rewrite introduce any generic workflow step that was not in the
  source docs, user request, or local manifests?
- Is any rule duplicated from another canonical file?
- Can any sentence be shorter without losing meaning?
- Are workflow and section names clear to readers who do not know the idiom?
- Does the final section give a useful next action or stop cleanly?
