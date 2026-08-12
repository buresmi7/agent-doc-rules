import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  MantineProvider,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  createTheme,
} from '@mantine/core';
import { maxReportDocumentBytes } from '@buresmi7/agent-e2e-report';
import { numberDiffLines, omissionMessage } from './diff.mjs';
import { activityStatus, overviewSubtitle } from './presentation.mjs';
import { formatByteSize, readReportFile } from './report-loader.mjs';

const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyMonospace: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
  headings: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeight: '650',
  },
});

export function App() {
  const [report, setReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [colorScheme, setColorScheme] = useState('light');
  const loadRequest = useRef(0);

  async function loadFile(file) {
    if (!file) return;

    const request = loadRequest.current + 1;
    loadRequest.current = request;
    setLoading(true);
    setLoadError('');

    try {
      const nextReport = await readReportFile(file);

      if (request !== loadRequest.current) return;

      setReport(nextReport);
      setFileName(file.name || 'report.json');
    } catch (error) {
      if (request !== loadRequest.current) return;

      setLoadError(error.message || 'The report could not be opened.');
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }

  function closeReport() {
    loadRequest.current += 1;
    setReport(null);
    setFileName('');
    setLoadError('');
    setLoading(false);
  }

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      {report ? (
        <ReportViewer
          colorScheme={colorScheme}
          error={loadError}
          fileName={fileName}
          loading={loading}
          onClose={closeReport}
          onDismissError={() => setLoadError('')}
          onLoadFile={loadFile}
          onToggleColorScheme={() => setColorScheme((value) => (
            value === 'light' ? 'dark' : 'light'
          ))}
          report={report}
        />
      ) : (
        <Landing
          colorScheme={colorScheme}
          error={loadError}
          loading={loading}
          onLoadFile={loadFile}
          onToggleColorScheme={() => setColorScheme((value) => (
            value === 'light' ? 'dark' : 'light'
          ))}
        />
      )}
    </MantineProvider>
  );
}

function Landing({ colorScheme, error, loading, onLoadFile, onToggleColorScheme }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleDragEnter(event) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    onLoadFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <Brand />
        <ThemeButton colorScheme={colorScheme} onClick={onToggleColorScheme} />
      </header>

      <main className="landing-main">
        <section className="landing-copy">
          <Badge color="indigo" variant="light" size="lg">Agent E2E reports</Badge>
          <Title order={1}>See the whole run, not just the failure.</Title>
          <Text c="dimmed" size="lg">
            Inspect every prompt, response, expectation, tool action, and project
            diff from one portable report file.
          </Text>
        </section>

        <Paper
          aria-labelledby="open-report-heading"
          className={`drop-zone${dragActive ? ' is-dragging' : ''}`}
          component="section"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          shadow="xl"
          withBorder
        >
          <input
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              onLoadFile(event.target.files?.[0]);
              event.target.value = '';
            }}
            ref={inputRef}
            type="file"
          />
          <ThemeIcon className="drop-icon" color="indigo" radius="xl" size={72} variant="light">
            <Icon name="upload" size={32} />
          </ThemeIcon>
          <Title id="open-report-heading" order={2}>
            {dragActive ? 'Drop the report here' : 'Open report.json'}
          </Title>
          <Text c="dimmed">Drag and drop the file, or choose it from this device.</Text>
          <Button loading={loading} mt="sm" onClick={openPicker} size="md">
            Choose report
          </Button>
          <Text c="dimmed" size="xs">
            Maximum size {formatByteSize(maxReportDocumentBytes)}
          </Text>
        </Paper>

        {error ? (
          <Alert className="landing-error" color="red" icon={<Icon name="error" />} title="Could not open report">
            {error}
          </Alert>
        ) : null}

        <Group className="privacy-note" gap="xs" justify="center">
          <Icon name="lock" size={15} />
          <Text c="dimmed" size="sm">
            Processed locally. Nothing is uploaded, fetched, or stored.
          </Text>
        </Group>
      </main>
    </div>
  );
}

function ReportViewer({
  colorScheme,
  error,
  fileName,
  loading,
  onClose,
  onDismissError,
  onLoadFile,
  onToggleColorScheme,
  report,
}) {
  const [selection, setSelection] = useState('overview');
  const inputRef = useRef(null);
  const turns = report.turns;
  const selectedTurnIndex = selection.startsWith('turn:')
    ? Number(selection.slice('turn:'.length))
    : null;
  const selectedTurn = selectedTurnIndex === null ? null : turns[selectedTurnIndex];
  const scopedChanges = selectedTurn ? selectedTurn.changes : report.changes;
  const isChangesPage = selection === 'changes';

  useEffect(() => {
    setSelection('overview');
  }, [report]);

  function select(value) {
    setSelection(value);
  }

  return (
    <div className="viewer-page">
      <input
        accept="application/json,.json"
        className="visually-hidden"
        onChange={(event) => {
          onLoadFile(event.target.files?.[0]);
          event.target.value = '';
        }}
        ref={inputRef}
        type="file"
      />

      <ReportHeader
        colorScheme={colorScheme}
        fileName={fileName}
        loading={loading}
        onClose={onClose}
        onOpen={() => inputRef.current?.click()}
        onToggleColorScheme={onToggleColorScheme}
        report={report}
      />

      {error ? (
        <Alert
          className="viewer-load-error"
          color="red"
          icon={<Icon name="error" />}
          onClose={onDismissError}
          title="Could not open report"
          withCloseButton
        >
          {error}
        </Alert>
      ) : null}

      <div className={`report-layout${isChangesPage ? ' changes-page' : ''}`}>
        <aside className="report-navigation">
          <ScrollArea h="100%" type="auto">
            <Navigation report={report} selection={selection} onSelect={select} />
          </ScrollArea>
        </aside>

        <main className="report-content">
          <MobileNavigation report={report} selection={selection} onSelect={select} />
          {selection === 'overview' ? (
            <Overview onSelect={select} report={report} />
          ) : selectedTurn ? (
            <TurnDetail index={selectedTurnIndex} report={report} turn={selectedTurn} />
          ) : (
            <FinalChanges report={report} />
          )}
        </main>

        {!isChangesPage ? (
          <aside className="change-inspector">
            <ChangeExplorer
              changes={scopedChanges}
              emptyMessage={selectedTurn
                ? 'No project changes were recorded for this turn.'
                : 'No final project changes were recorded.'}
              title={selectedTurn ? `Turn ${selectedTurnIndex + 1} changes` : 'Final changes'}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function ReportHeader({
  colorScheme,
  fileName,
  loading,
  onClose,
  onOpen,
  onToggleColorScheme,
  report,
}) {
  const status = reportStatus(report);

  return (
    <header className="report-header">
      <Group className="report-header-brand" gap="sm" wrap="nowrap">
        <Brand compact />
        <Divider orientation="vertical" />
        <Box className="report-title-block">
          <Group gap="xs" wrap="nowrap">
            <Title className="report-title" order={1}>{report.scenario.name}</Title>
            <StatusBadge status={status} />
          </Group>
          <Text c="dimmed" className="report-file-name" size="xs" title={fileName}>
            {fileName}
          </Text>
        </Box>
      </Group>

      <Group gap="xs" wrap="nowrap">
        <ThemeButton colorScheme={colorScheme} onClick={onToggleColorScheme} />
        <Button
          leftSection={<Icon name="folder" size={16} />}
          loading={loading}
          onClick={onOpen}
          variant="default"
        >
          <span className="wide-button-label">Open another</span>
          <span className="short-button-label">Open</span>
        </Button>
        <ActionIcon aria-label="Close report" onClick={onClose} size="lg" variant="subtle">
          <Icon name="close" size={18} />
        </ActionIcon>
      </Group>
    </header>
  );
}

function Navigation({ report, selection, onSelect }) {
  const failedByTurn = new Map(
    report.turns.map((turn, index) => [
      index,
      turn.criteria.filter((criterion) => criterion.status === 'failed').length,
    ]),
  );

  return (
    <nav aria-label="Report sections" className="nav-content">
      <Text className="nav-label" c="dimmed" fw={700} size="xs">REPORT</Text>
      <NavButton
        active={selection === 'overview'}
        icon="overview"
        label="Overview"
        onClick={() => onSelect('overview')}
      />

      <Text className="nav-label turn-label" c="dimmed" fw={700} size="xs">SCENARIO TURNS</Text>
      <div className="turn-nav-list">
        {report.turns.map((turn, index) => (
          <NavButton
            active={selection === `turn:${index}`}
            badge={failedByTurn.get(index) || null}
            icon={turn.status === 'completed' ? 'check' : turn.status === 'incomplete' ? 'error' : 'clock'}
            key={turn.id}
            label={turn.id || `Turn ${index + 1}`}
            meta={`Turn ${index + 1}`}
            onClick={() => onSelect(`turn:${index}`)}
            status={turn.status}
          />
        ))}
      </div>

      <Text className="nav-label turn-label" c="dimmed" fw={700} size="xs">PROJECT</Text>
      <NavButton
        active={selection === 'changes'}
        badge={report.changes.length || null}
        icon="diff"
        label="Final changes"
        onClick={() => onSelect('changes')}
      />
    </nav>
  );
}

function NavButton({ active, badge, icon, label, meta, onClick, status }) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`nav-button${active ? ' is-active' : ''}`}
      onClick={onClick}
      type="button"
    >
      <span className={`nav-icon status-${status ?? 'neutral'}`}><Icon name={icon} size={16} /></span>
      <span className="nav-button-copy">
        {meta ? <span className="nav-button-meta">{meta}</span> : null}
        <span className="nav-button-label">{label}</span>
      </span>
      {badge ? <span className="nav-count">{badge}</span> : null}
    </button>
  );
}

function MobileNavigation({ report, selection, onSelect }) {
  return (
    <div className="mobile-navigation">
      <label htmlFor="report-section">Report section</label>
      <select
        id="report-section"
        onChange={(event) => onSelect(event.target.value)}
        value={selection}
      >
        <option value="overview">Overview</option>
        {report.turns.map((turn, index) => (
          <option key={turn.id} value={`turn:${index}`}>Turn {index + 1}: {turn.id}</option>
        ))}
        <option value="changes">Final changes ({report.changes.length})</option>
      </select>
    </div>
  );
}

function Overview({ onSelect, report }) {
  const criteria = report.turns.flatMap((turn) => turn.criteria);
  const counts = countCriteria(criteria);
  const completedTurns = report.turns.filter((turn) => turn.status === 'completed').length;
  const score = report.evaluation?.score;
  const scorePercent = score === null || score === undefined ? null : Math.round(score * 100);
  const failedCriteria = criteria.filter((criterion) => criterion.status === 'failed');
  const failedTurnByCriterion = new Map();

  report.turns.forEach((turn, turnIndex) => {
    turn.criteria.forEach((criterion) => failedTurnByCriterion.set(criterion.id, turnIndex));
  });

  return (
    <ContentContainer>
      <PageHeading
        eyebrow="Run summary"
        subtitle={overviewSubtitle(report)}
        title="Overview"
      />

      {report.status === 'error' ? (
        <Alert color="red" icon={<Icon name="error" />} title="Runtime error">
          {report.error?.message || 'The run stopped with an unknown error.'}
        </Alert>
      ) : null}

      {report.status === 'running' ? (
        <Alert color="blue" icon={<Icon name="clock" />} title="Run in progress">
          This checkpoint was written during the {report.stage} stage.
        </Alert>
      ) : null}

      <SimpleGrid className="metric-grid" cols={{ base: 2, sm: 4 }} spacing="sm">
        <MetricCard
          accent={statusColor(reportStatus(report))}
          label="Outcome"
          value={statusLabel(reportStatus(report))}
        />
        <MetricCard
          accent={scorePercent === null ? 'gray' : scorePercent >= report.passThreshold * 100 ? 'teal' : 'red'}
          label="Judge score"
          progress={scorePercent}
          value={scorePercent === null ? '—' : `${scorePercent}%`}
        />
        <MetricCard
          accent={completedTurns === report.turns.length ? 'teal' : 'yellow'}
          label="Turns completed"
          value={`${completedTurns} / ${report.turns.length}`}
        />
        <MetricCard
          accent={report.changes.length ? 'indigo' : 'gray'}
          label="Files changed"
          value={String(report.changes.length)}
        />
      </SimpleGrid>

      <Card className="section-card" padding="lg" radius="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={2}>Expectations</Title>
            <Text c="dimmed" size="sm">Evaluation across all scenario turns.</Text>
          </Box>
          <Group gap="xs">
            <StatusCount color="teal" count={counts.passed} label="Passed" />
            <StatusCount color="red" count={counts.failed} label="Failed" />
            <StatusCount color="gray" count={counts['not-evaluated']} label="Not evaluated" />
          </Group>
        </Group>
        <Progress.Root size="lg">
          {criteria.length > 0 ? (
            <>
              <Progress.Section color="teal" value={(counts.passed / criteria.length) * 100} />
              <Progress.Section color="red" value={(counts.failed / criteria.length) * 100} />
              <Progress.Section color="gray" value={(counts['not-evaluated'] / criteria.length) * 100} />
            </>
          ) : null}
        </Progress.Root>

        {failedCriteria.length > 0 ? (
          <Stack gap="sm" mt="lg">
            {failedCriteria.map((criterion) => (
              <button
                className="failed-criterion-link"
                key={criterion.id}
                onClick={() => onSelect(`turn:${failedTurnByCriterion.get(criterion.id)}`)}
                type="button"
              >
                <ThemeIcon color="red" radius="xl" size="md" variant="light"><Icon name="error" size={14} /></ThemeIcon>
                <span>
                  <strong>{criterion.id}</strong>
                  <span>{criterion.reason || criterion.content}</span>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
          </Stack>
        ) : (
          <Text c="dimmed" mt="md" size="sm">
            {criteria.length === 0 ? 'No expectations were recorded.' : 'No failed expectations were reported.'}
          </Text>
        )}
      </Card>

      <OverviewDetails report={report} />
      <div className="inline-change-explorer">
        <ChangeExplorer changes={report.changes} title="Final changes" />
      </div>
    </ContentContainer>
  );
}

function OverviewDetails({ report }) {
  const evaluation = report.evaluation;
  const fixes = evaluation?.requiredFixes ?? [];

  return (
    <div className="overview-details">
      <Card className="section-card" padding="lg" radius="lg" withBorder>
        <Title order={2}>Judge summary</Title>
        {evaluation ? (
          <Stack gap="lg" mt="md">
            {fixes.length > 0 ? (
              <section>
                <SectionLabel>Required fixes</SectionLabel>
                <ol className="fix-list">
                  {fixes.map((fix, index) => <li key={`${index}-${fix}`}>{fix}</li>)}
                </ol>
              </section>
            ) : null}
            <section>
              <SectionLabel>Notes</SectionLabel>
              <Text className="plain-copy" c={evaluation.notes ? undefined : 'dimmed'}>
                {evaluation.notes || 'No judge notes were recorded.'}
              </Text>
            </section>
          </Stack>
        ) : (
          <Text c="dimmed" mt="sm">The scenario has not been evaluated.</Text>
        )}
      </Card>

      <Card className="section-card" padding="lg" radius="lg" withBorder>
        <Title order={2}>Run details</Title>
        <dl className="metadata-list">
          <MetadataRow label="Runner" value={report.runner} />
          <MetadataRow label="Agent" value={agentLabel(report.agent)} />
          <MetadataRow label="Judge" value={report.agent?.model?.judge?.label} />
          <MetadataRow label="Pass threshold" value={percent(report.passThreshold)} />
          <MetadataRow label="Scenario source" value={report.scenario.source} mono />
          <MetadataRow label="Revision" value={String(report.revision)} />
          <MetadataRow label="Skills CLI" value={report.skillsCliVersion} />
          <MetadataRow label="Skill" value={report.skillPackage?.name} mono />
        </dl>
      </Card>

      {report.warnings.length > 0 ? (
        <Alert className="details-wide" color="yellow" icon={<Icon name="warning" />} title="Run warnings">
          <ul className="alert-list">
            {report.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}

function MetricCard({ accent, label, progress, value }) {
  return (
    <Card className="metric-card" padding="md" radius="lg" withBorder>
      <Text c="dimmed" fw={600} size="xs">{label.toUpperCase()}</Text>
      <Text className="metric-value" fw={700}>{value}</Text>
      {progress === null || progress === undefined ? (
        <span className={`metric-accent bg-${accent}`} />
      ) : (
        <Progress color={accent} mt="sm" size="sm" value={progress} />
      )}
    </Card>
  );
}

function StatusCount({ color, count, label }) {
  return <Badge color={color} variant="light">{count} {label}</Badge>;
}

function TurnDetail({ index, report, turn }) {
  return (
    <ContentContainer>
      <PageHeading
        badge={<StatusBadge status={turn.status} />}
        eyebrow={`Turn ${index + 1} of ${report.turns.length}`}
        subtitle={turn.source ? `Source: ${turn.source}` : 'No scenario source was recorded.'}
        title={turn.id}
      />

      {turn.error ? (
        <Alert color="red" icon={<Icon name="error" />} title={turn.error.name || 'Turn error'}>
          {turn.error.message}
        </Alert>
      ) : null}

      <section className="conversation" aria-label="Conversation">
        <MessagePanel kind="prompt" label="Scenario prompt" text={turn.prompt} />
        <MessagePanel
          empty={turn.status === 'pending' ? 'This turn did not run.' : 'No agent response was recorded.'}
          kind="response"
          label="Agent response"
          text={turn.response}
        />
      </section>

      <Card className="section-card" padding="lg" radius="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={2}>Expected outcomes</Title>
            <Text c="dimmed" size="sm">Assertions evaluated for this response.</Text>
          </Box>
          <ExpectationSummary criteria={turn.criteria} />
        </Group>
        <CriteriaList criteria={turn.criteria} />
      </Card>

      <Card className="section-card" padding="lg" radius="lg" withBorder>
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={2}>Activity</Title>
            <Text c="dimmed" size="sm">Commands and tools observed during this turn.</Text>
          </Box>
          <Badge color="gray" variant="light">{turn.activity.length}</Badge>
        </Group>
        <ActivityList activity={turn.activity} />
      </Card>

      <div className="inline-change-explorer">
        <ChangeExplorer
          changes={turn.changes}
          emptyMessage="No project changes were recorded for this turn."
          title={`Turn ${index + 1} changes`}
        />
      </div>
    </ContentContainer>
  );
}

function MessagePanel({ empty, kind, label, text }) {
  return (
    <article className={`message-panel message-${kind}`}>
      <Group gap="xs" mb="sm">
        <ThemeIcon color={kind === 'prompt' ? 'gray' : 'indigo'} radius="xl" size="sm" variant="light">
          <Icon name={kind === 'prompt' ? 'user' : 'spark'} size={13} />
        </ThemeIcon>
        <Text fw={700} size="xs">{label.toUpperCase()}</Text>
      </Group>
      <Text className="message-text" c={text ? undefined : 'dimmed'} component="div">
        {text || empty}
      </Text>
    </article>
  );
}

function ExpectationSummary({ criteria }) {
  const counts = countCriteria(criteria);

  if (criteria.length === 0) return <Badge color="gray" variant="light">None</Badge>;
  if (counts.failed) return <Badge color="red" variant="light">{counts.failed} failed</Badge>;
  if (counts['not-evaluated']) return <Badge color="gray" variant="light">Not evaluated</Badge>;
  return <Badge color="teal" variant="light">All passed</Badge>;
}

function CriteriaList({ criteria }) {
  if (criteria.length === 0) {
    return <EmptyState icon="expectation" message="No expectations were recorded for this turn." />;
  }

  return (
    <Stack gap="sm">
      {criteria.map((criterion) => (
        <Paper
          className={`criterion-card criterion-${criterion.status}`}
          key={criterion.id}
          p="md"
          radius="md"
          withBorder
        >
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon
              color={statusColor(criterion.status)}
              radius="xl"
              size="md"
              variant="light"
            >
              <Icon name={criterion.status === 'passed' ? 'check' : criterion.status === 'failed' ? 'error' : 'minus'} size={14} />
            </ThemeIcon>
            <Box className="criterion-copy">
              <Group gap="xs" mb={4}>
                <Text className="criterion-id" fw={700} size="sm">{criterion.id}</Text>
                <Badge color={statusColor(criterion.status)} size="xs" variant="light">
                  {statusLabel(criterion.status)}
                </Badge>
              </Group>
              <Text size="sm">{criterion.content}</Text>
              {criterion.reason ? (
                <Text className="criterion-reason" c="red" mt="xs" size="sm">
                  <strong>Why it failed:</strong> {criterion.reason}
                </Text>
              ) : null}
            </Box>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

function ActivityList({ activity }) {
  if (activity.length === 0) {
    return <EmptyState icon="activity" message="No tool activity was recorded." />;
  }

  return (
    <ol className="activity-list">
      {activity.map((item, index) => {
        const details = activityDetails(item);
        const status = activityStatus(item);

        return (
          <li className="activity-item" key={`${index}-${item.type}`}>
            <span className={`activity-dot status-${status ?? 'neutral'}`}>
              <Icon name={activityIcon(item.type)} size={14} />
            </span>
            <div className="activity-copy">
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Text fw={650} size="sm">{details.title}</Text>
                {details.status ? (
                  <Badge color={status === 'failed' ? 'red' : 'gray'} size="xs" variant="light">
                    {details.status}
                  </Badge>
                ) : null}
              </Group>
              {details.detail ? <Text c="dimmed" className="activity-detail" size="sm">{details.detail}</Text> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function FinalChanges({ report }) {
  return (
    <ContentContainer>
      <PageHeading
        eyebrow="Project state"
        subtitle="The final diff after all recorded scenario turns."
        title="Final changes"
      />
      <ChangeExplorer
        changes={report.changes}
        emptyMessage="The scenario left the project unchanged."
        title={`${report.changes.length} changed ${report.changes.length === 1 ? 'file' : 'files'}`}
      />
    </ContentContainer>
  );
}

function ChangeExplorer({ changes, emptyMessage = 'No project changes were recorded.', title }) {
  const [selectedPath, setSelectedPath] = useState(changes[0]?.path ?? null);
  const selected = changes.find((change) => change.path === selectedPath) ?? changes[0] ?? null;

  useEffect(() => {
    setSelectedPath(changes[0]?.path ?? null);
  }, [changes]);

  if (changes.length === 0) {
    return (
      <div className="change-explorer empty-change-explorer">
        <div className="change-explorer-heading">
          <Title order={2}>{title}</Title>
        </div>
        <EmptyState icon="diff" message={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="change-explorer">
      <div className="change-explorer-heading">
        <Box>
          <Title order={2}>{title}</Title>
          <Text c="dimmed" size="xs">Select a file to inspect its unified diff.</Text>
        </Box>
        <Badge color="indigo" variant="light">{changes.length}</Badge>
      </div>

      <div aria-label="Changed files" className="file-tabs" role="group">
        {changes.map((change) => (
          <button
            aria-pressed={selected?.path === change.path}
            className={`file-tab${selected?.path === change.path ? ' is-active' : ''}`}
            key={change.path}
            onClick={() => setSelectedPath(change.path)}
            type="button"
          >
            <span className={`file-status file-status-${change.status}`}>{fileStatusLetter(change.status)}</span>
            <span className="file-path" title={change.path}>{change.path}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <section aria-label={`Diff for ${selected.path}`} className="diff-panel">
          <div className="diff-header">
            <Group gap="xs" wrap="nowrap">
              <Icon name="file" size={16} />
              <Text className="diff-path" fw={650} size="sm" title={selected.path}>{selected.path}</Text>
            </Group>
            <Badge color={fileStatusColor(selected.status)} size="xs" variant="light">
              {selected.status}
            </Badge>
          </div>
          {selected.patch?.format === 'unified' ? (
            <DiffView key={selected.path} lines={selected.patch.lines} />
          ) : (
            <EmptyState icon="hidden" message={omissionMessage(selected)} />
          )}
        </section>
      ) : null}
    </div>
  );
}

function DiffView({ lines }) {
  const numberedLines = useMemo(() => numberDiffLines(lines), [lines]);
  const [visibleCount, setVisibleCount] = useState(500);
  const visibleLines = numberedLines.slice(0, visibleCount);

  return (
    <div className="diff-scroll" tabIndex={0}>
      <div className="diff-table" role="table" aria-label="Unified diff">
        {visibleLines.map((line) => (
          <div className={`diff-line diff-${line.kind}`} key={line.index} role="row">
            <span aria-hidden="true" className="line-number">{line.oldNumber ?? ''}</span>
            <span aria-hidden="true" className="line-number">{line.newNumber ?? ''}</span>
            <code className="line-content">{line.line || ' '}</code>
          </div>
        ))}
      </div>
      {visibleCount < numberedLines.length ? (
        <div className="diff-load-more">
          <Text c="dimmed" size="xs">
            Showing {visibleLines.length} of {numberedLines.length} lines
          </Text>
          <Button onClick={() => setVisibleCount((value) => value + 1000)} size="xs" variant="light">
            Load more lines
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ContentContainer({ children }) {
  return <div className="content-container">{children}</div>;
}

function PageHeading({ badge, eyebrow, subtitle, title }) {
  return (
    <header className="page-heading">
      <Text c="indigo" fw={700} size="xs">{eyebrow.toUpperCase()}</Text>
      <Group gap="sm" mt={4} wrap="wrap">
        <Title order={1}>{title}</Title>
        {badge}
      </Group>
      <Text c="dimmed" mt={4}>{subtitle}</Text>
    </header>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="empty-state">
      <ThemeIcon color="gray" radius="xl" size="lg" variant="light"><Icon name={icon} size={18} /></ThemeIcon>
      <Text c="dimmed" size="sm">{message}</Text>
    </div>
  );
}

function SectionLabel({ children }) {
  return <Text c="dimmed" fw={700} mb="xs" size="xs">{children.toUpperCase()}</Text>;
}

function MetadataRow({ label, mono, value }) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div className="metadata-row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <Badge color={statusColor(status)} leftSection={<Icon name={statusIcon(status)} size={11} />} variant="light">
      {statusLabel(status)}
    </Badge>
  );
}

function ThemeButton({ colorScheme, onClick }) {
  return (
    <ActionIcon
      aria-label={`Use ${colorScheme === 'light' ? 'dark' : 'light'} theme`}
      onClick={onClick}
      size="lg"
      title={`Use ${colorScheme === 'light' ? 'dark' : 'light'} theme`}
      variant="subtle"
    >
      <Icon name={colorScheme === 'light' ? 'moon' : 'sun'} size={18} />
    </ActionIcon>
  );
}

function Brand({ compact = false }) {
  return (
    <Group className="brand" gap="sm" wrap="nowrap">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact ? (
        <Box>
          <Text className="brand-name" fw={750}>Agent E2E</Text>
          <Text c="dimmed" size="xs">Report viewer</Text>
        </Box>
      ) : null}
    </Group>
  );
}

function Icon({ name, size = 18 }) {
  const paths = {
    activity: <><path d="M4 13h4l2-6 4 10 2-6h4" /></>,
    arrow: <><path d="m9 18 6-6-6-6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <><path d="m7 7 10 10M17 7 7 17" /></>,
    command: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 9 3 3-3 3M13 15h4" /></>,
    diff: <><path d="M7 3v12a4 4 0 0 0 4 4h6" /><path d="m14 16 3 3-3 3M17 3v7M14 6h6" /></>,
    error: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
    expectation: <><path d="M5 4h14v16H5zM8 9l2 2 4-4M8 15h8" /></>,
    file: <><path d="M6 3h8l4 4v14H6zM14 3v5h4" /></>,
    folder: <><path d="M3 6h7l2 2h9v11H3z" /></>,
    hidden: <><path d="M3 12s3-5 9-5 9 5 9 5-3 5-9 5-9-5-9-5Z" /><path d="m4 4 16 16" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    minus: <><path d="M6 12h12" /></>,
    moon: <><path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" /></>,
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
    spark: <><path d="m12 3 1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9L12 3ZM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5M5 15v5h14v-5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 18h.01" /></>,
    web: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {paths[name] ?? paths.file}
    </svg>
  );
}

function countCriteria(criteria) {
  return criteria.reduce((counts, criterion) => {
    counts[criterion.status] = (counts[criterion.status] ?? 0) + 1;
    return counts;
  }, { passed: 0, failed: 0, 'not-evaluated': 0 });
}

function reportStatus(report) {
  return ['passed', 'failed', 'error'].includes(report.status) ? report.status : 'running';
}

function statusColor(status) {
  if (status === 'passed' || status === 'completed') return 'teal';
  if (status === 'failed' || status === 'error' || status === 'incomplete') return 'red';
  if (status === 'running') return 'blue';
  return 'gray';
}

function statusIcon(status) {
  if (status === 'passed' || status === 'completed') return 'check';
  if (status === 'failed' || status === 'error' || status === 'incomplete') return 'error';
  return 'clock';
}

function statusLabel(status) {
  const labels = {
    completed: 'Completed',
    error: 'Runtime error',
    failed: 'Failed',
    incomplete: 'Incomplete',
    'not-evaluated': 'Not evaluated',
    passed: 'Passed',
    pending: 'Pending',
    running: 'Running',
  };

  return labels[status] ?? String(status);
}

function percent(value) {
  return value === null || value === undefined ? null : `${Math.round(value * 100)}%`;
}

function agentLabel(agent) {
  return agent?.model?.agent?.label || agent?.name || agent?.command || null;
}

function activityIcon(type) {
  if (type === 'command_execution') return 'command';
  if (type === 'file_change') return 'diff';
  if (type === 'web_search') return 'web';
  return 'spark';
}

function activityDetails(item) {
  if (item.type === 'command_execution') {
    return {
      title: 'Command',
      detail: item.commandSummary || 'No command summary',
      status: item.exitCode === null ? item.status : `exit ${item.exitCode}`,
    };
  }

  if (item.type === 'file_change') {
    return {
      title: 'File change',
      detail: item.changes.map((change) => `${change.kind ?? 'changed'} ${change.path}`).join(', '),
      status: item.status,
    };
  }

  if (item.type === 'mcp_tool_call') {
    return {
      title: 'MCP tool call',
      detail: [item.server, item.tool].filter(Boolean).join('/') || 'Unknown tool',
      status: item.status,
    };
  }

  return {
    title: 'Web search',
    detail: item.query || 'No query recorded',
    status: item.status,
  };
}

function fileStatusLetter(status) {
  return status === 'created' ? 'A' : status === 'deleted' ? 'D' : 'M';
}

function fileStatusColor(status) {
  return status === 'created' ? 'teal' : status === 'deleted' ? 'red' : 'yellow';
}
