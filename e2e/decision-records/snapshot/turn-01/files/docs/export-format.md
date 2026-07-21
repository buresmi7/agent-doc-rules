# Export Format

The exporter writes one CSV row per invoice with `id`, `customer`, and `total`
columns.

The streaming exporter was deferred for the first internal release. The team
accepted the simpler in-memory implementation for now because invoices are
small in the current pilot dataset. See
[`docs/decisions/in-memory-csv-exporter.md`](decisions/in-memory-csv-exporter.md)
for the accepted trade-off and revisit conditions.
