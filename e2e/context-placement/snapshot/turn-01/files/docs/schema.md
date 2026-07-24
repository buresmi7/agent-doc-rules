# Observation Schema

## CSV Input

The parser accepts UTF-8 CSV input with these columns:

- `species`
- `site`
- `observed_at`
- `count`

Rows with empty `species` values are dropped. The import report records the row
number for each dropped row.

## JSON Output

Observation JSON contains:

- `species`
- `site`
- `observedAt`
- `count`
