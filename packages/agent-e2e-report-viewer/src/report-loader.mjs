import {
  maxReportDocumentBytes,
  reportFormat,
  reportFormatVersion,
  validateScenarioReport,
} from '@buresmi7/agent-e2e-report';

export class ReportLoadError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'ReportLoadError';
    this.code = code;
  }
}

export function parseReportText(text) {
  let value;

  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ReportLoadError(
      'invalid-json',
      'This file is not valid JSON. Select an Agent E2E report.json file.',
      { cause: error },
    );
  }

  try {
    return validateScenarioReport(value);
  } catch (error) {
    const version = value && typeof value === 'object'
      ? `${value.format ?? 'unknown'} v${value.formatVersion ?? 'unknown'}`
      : 'unknown format';

    throw new ReportLoadError(
      'invalid-report',
      `This is not a supported ${reportFormat} v${reportFormatVersion} document (${version}). ${error.message}`,
      { cause: error },
    );
  }
}

export async function readReportFile(
  file,
  { maxBytes = maxReportDocumentBytes } = {},
) {
  if (!file || typeof file.text !== 'function') {
    throw new ReportLoadError('missing-file', 'Select a report.json file to continue.');
  }

  if (file.size > maxBytes) {
    throw new ReportLoadError(
      'report-too-large',
      `This report is ${formatByteSize(file.size)}. The viewer limit is ${formatByteSize(maxBytes)}.`,
    );
  }

  let text;

  try {
    text = await file.text();
  } catch (error) {
    throw new ReportLoadError(
      'read-failed',
      'The browser could not read this file. Try selecting it again.',
      { cause: error },
    );
  }

  return parseReportText(text);
}

export function formatByteSize(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'unknown size';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KiB', 'MiB', 'GiB'];
  let amount = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }

  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${unit}`;
}
