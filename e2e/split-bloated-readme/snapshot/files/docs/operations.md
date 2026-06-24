# Operations

Use this page for retry replay, release checks, and troubleshooting.

## Retry Replay

When delivery fails because the queue is unavailable, the service writes the
event to local retry storage.

Operators replay retry storage with:

```sh
npm run replay
```

Use a dry run before changing code or release state after a replay failure:

```sh
npm run replay -- --dry-run
```

If the replay script is unavailable in a checkout, record the skipped command and
the remaining risk before continuing.

## Release Steps

1. Run `npm test`.
2. Run `npm run replay -- --dry-run`.
3. Check that [docs/contracts/billing-events.md](contracts/billing-events.md)
   still matches the queue schema.
4. Update the changelog.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Signatures fail locally | Check that the fixture header matches the fixture body. |
| Replay fails | Run replay again with `--dry-run` before changing code. |
| Queue writes fail | Do not document the raw payload. |
