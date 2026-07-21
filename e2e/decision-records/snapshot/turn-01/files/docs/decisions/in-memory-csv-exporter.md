# Decision: In-Memory CSV Exporter For Pilot

Status: Accepted
Date: 2026-07-16

## Context

The first internal pilot exports small invoice datasets. A streaming exporter
would scale better and avoid holding the whole CSV output in memory, but it is
not required for the current pilot data size.

## Decision

Use the simpler in-memory CSV exporter for the pilot.

## Trade-Off

This defers the cleaner streaming design and accepts that export memory use will
grow with the number and size of invoices.

## Consequences

Future maintainers should treat the in-memory exporter as an intentional pilot
choice, not an accidental implementation gap. Do not rely on it for larger
datasets without checking memory behavior and export latency.

## Applies To

- `src/exporter.js`
- `docs/export-format.md`

## Backlinks

- `docs/export-format.md` points readers back to this decision.

## Revisit When

- Pilot invoice datasets grow beyond the current small batch size.
- Export latency or memory use becomes visible to finance users.
- The exporter becomes part of an external or automated bulk workflow.
