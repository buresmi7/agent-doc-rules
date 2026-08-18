# Agent E2E Report

`@buresmi7/agent-e2e-report` defines and validates the `report.json` document
shared by the Agent E2E runner and report viewers. The package is
dependency-free and can run in Node.js or a browser bundle. See the
[report format reference](docs/report-format.md) for the full document model.

## Install

```bash
pnpm add @buresmi7/agent-e2e-report@0.1.1
```

## API

```js
import {
  maxReportDocumentBytes,
  reportFormat,
  reportFormatVersion,
  validateScenarioReport,
} from '@buresmi7/agent-e2e-report';

const report = JSON.parse(reportJson);
validateScenarioReport(report);
```

`validateScenarioReport()` returns the input document when it is valid and
throws an `Error` when it does not match the current contract. Check `format`
and `formatVersion` before choosing a viewer or migration path.

The package validates an in-memory document. Reading files and enforcing
`maxReportDocumentBytes` at the file boundary remain the caller's
responsibility.
