# Observation Schema

Observation JSON contains `species`, `site`, `observedAt`, and `count`.

## CSV Input

The parser accepts UTF-8 CSV input with these columns:

| Column | Output field |
| --- | --- |
| `species` | `species` |
| `site` | `site` |
| `observed_at` | `observedAt` |
| `count` | `count` |

Rows with empty `species` values are dropped. The importer records the row
number for each dropped row in the import report.

Do not include private site names in public schema examples or generated JSON
examples.
