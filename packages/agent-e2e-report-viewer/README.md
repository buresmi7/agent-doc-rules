# Agent E2E report viewer

This private workspace package builds the static viewer for
`agent-e2e-report` documents. Drop a local `report.json` onto the page to
inspect the scenario, chat turns, expectations, activity, and project diffs.

The viewer reads the selected file with the browser File API. It does not
upload, fetch, persist, or execute report content. The final build contains no
CDN or other runtime dependencies.

## Development

From the monorepo root:

```sh
corepack pnpm --filter @buresmi7/agent-e2e-report-viewer dev
```

## Build

```sh
corepack pnpm --filter @buresmi7/agent-e2e-report-viewer build
```

The build writes one self-contained file to `dist/index.html`. Open that file
directly, serve it from any static host, or deploy it to GitHub Pages. The same
artifact works in each case.

## Test

```sh
corepack pnpm --filter @buresmi7/agent-e2e-report-viewer test
```

## GitHub Pages

The repository workflow builds and deploys this package after relevant changes
reach `master`. Configure the repository's Pages source as **GitHub Actions**
once before the first deployment. The uploaded Pages artifact contains only the
self-contained viewer; it does not contain report files.
