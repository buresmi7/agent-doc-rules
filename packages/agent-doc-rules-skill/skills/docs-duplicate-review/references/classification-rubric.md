# Duplicate Classification Rubric

Classify meaning and ownership, not shared vocabulary. Read both full sections
before deciding.

## Verdicts

### `fail`

Use `fail` when two locations independently own the same durable fact, rule,
constraint, procedure, or rationale. Keeping either copy current would not
reliably update the other.

Typical cases:

- two instruction files define the same reusable rule,
- README and a reference page both maintain the same command contract,
- separate runbooks repeat the same ordered procedure,
- two explanations independently state the same architectural decision.

The repair must name one canonical file owner, or `none — remove every copy`
when the repeated content should not remain anywhere. Remove other durable
copies or replace them with a short routing link and only the context needed at
that location. Never use `undetermined` for a `fail`.

### `warn`

Use `warn` when the passages overlap but ownership or maintenance risk is not
clear from repository evidence. Examples include summaries that may contain
too much detail, near-duplicate guidance with a meaningful scope difference,
or two pages that appear to compete for ownership.

State what evidence would resolve the warning. Name a likely canonical owner
only when the repository supports that choice.

### `ok`

Use `ok` when similar text serves a necessary local purpose or does not create
competing ownership. Common cases include:

- a short summary that links to the canonical detail,
- a routing sentence in `AGENTS.md`, README, or an index,
- a fixture that intentionally repeats the rule under test,
- changelog or decision history,
- standardized legal, safety, or compatibility text,
- headings, examples, or code that share terms but not a durable claim.

Explain the local purpose. Do not recommend edits merely to reduce a similarity
score.

## Evidence Order

Use this order when evidence conflicts:

1. repository-local ownership and documentation-placement rules,
2. links and explicit source-of-truth statements,
3. manifests, source code, schemas, configs, and tests supporting the claim,
4. surrounding section purpose and intended audience,
5. candidate similarity signals.

A higher candidate score is not stronger than clear ownership evidence.

## Finding Shape

Report each actionable pair in this shape:

```text
<candidate-id> <fail|warn|ok>
Left: path/to/file.md:line
Right: path/to/other.md:line
Reason: <why the meanings and owners do or do not conflict>
Canonical owner: <path, "none — remove every copy", or "undetermined" for warn only>
Repair: <specific edit or "none">
```

Group repeated candidates for the same underlying rule into one finding when
that makes the repair clearer. Preserve every affected location in the report.
