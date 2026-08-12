export function classifyDiffLine(line) {
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+++') || line.startsWith('---')) return 'file-header';
  if (line.startsWith('+')) return 'addition';
  if (line.startsWith('-')) return 'deletion';
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'meta';
  return 'context';
}

export function numberDiffLines(lines) {
  let oldLine = null;
  let newLine = null;

  return lines.map((rawLine, index) => {
    const line = String(rawLine);
    const kind = classifyDiffLine(line);

    if (kind === 'hunk') {
      const range = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);

      if (range) {
        oldLine = Number(range[1]);
        newLine = Number(range[2]);
      }

      return { index, kind, line, oldNumber: null, newNumber: null };
    }

    if (kind === 'file-header' || kind === 'meta') {
      return { index, kind, line, oldNumber: null, newNumber: null };
    }

    const oldNumber = kind === 'addition' ? null : oldLine;
    const newNumber = kind === 'deletion' ? null : newLine;

    if (kind !== 'addition' && oldLine !== null) oldLine += 1;
    if (kind !== 'deletion' && newLine !== null) newLine += 1;

    return { index, kind, line, oldNumber, newNumber };
  });
}

export function omissionMessage(change) {
  const reason = change?.omission?.reason;
  const sizes = [change?.before?.byteLength, change?.after?.byteLength]
    .filter(Number.isFinite);
  const size = sizes.length > 0 ? ` (${sizes.join(' → ')} bytes)` : '';
  const omittedBytes = change?.omission?.byteLength;
  const omittedSize = Number.isFinite(omittedBytes) ? ` (${omittedBytes} bytes)` : '';

  if (reason === 'binary') return `Binary diff omitted${size}.`;
  if (reason === 'sensitive-path') return 'Diff omitted for a potentially sensitive path.';
  if (reason === 'sensitive-content') return 'Diff omitted because it resembles private key data.';
  if (reason === 'empty-file') return 'No patch body is available for an empty file.';
  if (reason === 'file-too-large') return `Diff omitted because a file version is too large${size}.`;
  if (reason === 'diff-too-large') return `Diff omitted because the patch is too large${omittedSize}.`;
  if (reason === 'report-budget') return `Diff omitted because the report data budget was reached${omittedSize}.`;
  return 'No diff was recorded for this file.';
}
