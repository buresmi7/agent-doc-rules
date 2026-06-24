# Signal Cache

Signal Cache stores recent event signals in memory and exposes a lookup helper
used by tests.

## Repository Role

This repository is a private Node.js package for the in-memory signal cache.
Package metadata and scripts live in `package.json`.

## Quick Start

Run the test suite from the repository root:

```bash
npm test
```

The `test` script runs Node's built-in test runner with `node --test`.

## Project Notes

- The service stores recent event signals in memory.
- The project does not include a deploy script.
- The project does not connect to a cloud cache.
- Add deployment or cloud-cache details only after the repository adds them.
