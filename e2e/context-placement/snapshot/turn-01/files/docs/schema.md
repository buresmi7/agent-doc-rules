# Observation Schema

The parser accepts UTF-8 CSV input with these columns:

- `species`
- `site`
- `observed_at`
- `count`

Observation JSON contains:

- `species`
- `site`
- `observedAt`
- `count`

Rows with empty `species` values are dropped. The importer records the dropped
row number in the import report.
