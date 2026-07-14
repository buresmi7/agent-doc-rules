# In-Memory CSV Exporter

Status: Accepted

Date: 2026-07-14

## Context

Invoice Exporter converts invoice JSON files into CSV files for the finance
team. The exporter writes one CSV row per invoice with `id`, `customer`, and
`total` columns.

A streaming exporter would be cleaner long term, but the first internal release
uses the simpler in-memory implementation. The team accepted that choice because
invoices are small in the current pilot dataset.

## Decision

Keep the in-memory CSV exporter for the pilot instead of replacing it with a
streaming exporter now.

## Trade-Off And Consequences

The in-memory exporter is simpler to maintain during the pilot and matches the
current dataset size.

The trade-off is that export memory use grows with the number of invoices. A
larger dataset may make the exporter slower or less reliable than a streaming
implementation.

## Affected Surfaces

- `src/exporter.js`
- `docs/export-format.md`

## Backlinks

`docs/export-format.md` links to this record from the export format notes.

## Revisit Conditions

Revisit this decision before expanding beyond the pilot dataset or when invoice
exports become large enough that memory use is a practical concern.

Run `npm test` before changing export behavior.
