# Signal Cache

Signal Cache stores recent event signals in memory and exposes a lookup helper
used by tests. This repository is a small private Node.js package for that cache
behavior.

## Repository Role

The project is not a cloud cache service. It does not include deployment code,
cloud-cache integration, or runtime infrastructure scripts.

Use this repository to understand, change, and test the in-memory signal cache
logic that exists in the source files.

## Verification

Run the test suite with:

```bash
npm test
```

The `test` script is defined in `package.json` as `node --test`.

## Project Notes

Do not document deployment steps or cloud-cache behavior unless the repository
adds those features first. Keep new contributor instructions tied to commands and
behavior that are present in the project files.
