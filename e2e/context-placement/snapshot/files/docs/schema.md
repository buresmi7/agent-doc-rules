# Observation Schema

Use this page as the reference for parser input and observation JSON output.

## CSV Input

The parser accepts UTF-8 CSV input with these columns:

| Column |
| --- |
| `species` |
| `site` |
| `observed_at` |
| `count` |

Rows with empty `species` values are dropped. The importer records the dropped
row number in the import report.

## JSON Output

Observation JSON contains these fields:

| Field | Source CSV Column |
| --- | --- |
| `species` | `species` |
| `site` | `site` |
| `observedAt` | `observed_at` |
| `count` | `count` |
