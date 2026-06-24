# Signal Cache

Signal Cache stores recent event signals in memory and exposes a lookup helper
used by tests.

## Repository Role

This repository is a small Node.js project for working on the in-memory signal
cache behavior. The package manifest is the source of truth for available npm
scripts.

## Quick Start

Run the test suite from the repository root:

```bash
npm test
```

## Verification

Run this check before submitting changes:

| Command | Purpose |
| --- | --- |
| `npm test` | Runs the Node.js test suite with `node --test`. |

## Project Notes

This project does not include a deploy script. It does not connect to a cloud
cache. Do not add those details unless the repository adds them first.
