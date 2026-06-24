# Habitat Importer

Habitat Importer reads CSV exports from field teams and writes normalized
species observations to JSON files.

## Canonical Docs

The listed document is canonical for its topic.

| Document | Content |
| --- | --- |
| `AGENTS.md` | Agent routing, local invariants, and verification rules |
| `docs/schema.md` | CSV input columns and observation JSON fields |
| `docs/output-format.md` | Why the importer writes JSON output |
| `docs/data-safety.md` | Rules for private site names and generated examples |
| `docs/troubleshooting.md` | Steps for fixture failures |

## Verification

Run the test suite before changing parser behavior.

```sh
npm test
```
