# Operations

## Release Steps

1. Run `npm test`.
2. Run the replay dry run when the replay command is available.
3. Check that `docs/contracts/billing-events.md` still matches the queue schema.
4. Update the changelog.

`package.json` currently declares only the `test` script. Verify the replay
command before relying on `npm run replay -- --dry-run`.

## Troubleshooting

- If signatures fail locally, check that the fixture header matches the fixture
  body.
- If replay fails, run it again with `--dry-run` before changing code.
- If queue writes fail, do not document the raw payload.
