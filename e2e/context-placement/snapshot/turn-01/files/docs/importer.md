# Importer Input

The parser accepts UTF-8 CSV input with these columns:

| Column | Meaning |
| --- | --- |
| `species` | Species name for the observation. |
| `site` | Field site for the observation. |
| `observed_at` | Observation timestamp from the source CSV. |
| `count` | Observation count from the source CSV. |

Rows with empty `species` values are dropped. The importer records the dropped
row number in the import report.
