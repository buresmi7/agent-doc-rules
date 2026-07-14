# Observation Schema

Observation JSON contains `species`, `site`, `observedAt`, and `count`.

The importer reads `observed_at` from source CSV files and writes it as
`observedAt` in normalized JSON observations.
