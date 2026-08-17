import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defaultExclude,
  defaultInclude,
  duplicateCandidateDefaults,
} from '../packages/docs-validator/src/defaults.mjs';

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function checkRepositorySelfCompliance(root = defaultRepoRoot) {
  const errors = [];
  const read = async (path) => readFile(join(root, path), 'utf8');
  const [
    agents,
    readme,
    development,
    validatorReadme,
    runnerReadme,
    runnerScenarioGuide,
    skillReadme,
    adoptionGuide,
    reportReadme,
    manifest,
    skillManifest,
    validatorManifest,
    runnerManifest,
    reportManifest,
  ] = await Promise.all([
    read('AGENTS.md'),
    read('README.md'),
    read('docs/development.md'),
    read('packages/docs-validator/README.md'),
    read('packages/agent-e2e-runner/README.md'),
    read('packages/agent-e2e-runner/docs/writing-agent-scenarios.md'),
    read('packages/agent-doc-rules-skill/README.md'),
    read('packages/agent-doc-rules-skill/docs/adoption.md'),
    read('packages/agent-e2e-report/README.md'),
    read('package.json').then(JSON.parse),
    read('packages/agent-doc-rules-skill/package.json').then(JSON.parse),
    read('packages/docs-validator/package.json').then(JSON.parse),
    read('packages/agent-e2e-runner/package.json').then(JSON.parse),
    read('packages/agent-e2e-report/package.json').then(JSON.parse),
  ]);

  checkAgentInstructions(agents, errors);
  checkRootReadme(readme, manifest, errors);
  checkDevelopmentGuide(development, errors);
  checkPackageReadmes({
    validatorReadme,
    runnerReadme,
    runnerScenarioGuide,
    skillReadme,
    adoptionGuide,
    reportReadme,
    skillManifest,
    validatorManifest,
    runnerManifest,
    reportManifest,
  }, errors);
  await checkDecisionRecords(root, errors);
  await checkConfigExceptionGovernance(root, errors);

  return errors;
}

export function collectPersistedExceptions(config) {
  const docs = config.docs ?? {};
  const configuredExcludes = arrayValues(docs.exclude);
  const configuredIncludes = arrayValues(docs.include);
  const baseExcludes = new Set(configuredExcludes.length > 0 ? configuredExcludes : defaultExclude);
  const defaultExcludes = new Set(defaultExclude);
  const exceptions = [];

  if (configuredIncludes.length > 0 && !sameStringSet(configuredIncludes, defaultInclude)) {
    exceptions.push({ setting: 'docs.include', value: configuredIncludes });
  }

  for (const value of configuredExcludes) {
    if (!defaultExcludes.has(value)) {
      exceptions.push({ setting: 'docs.exclude', value });
    }
  }

  for (const phase of ['markdown', 'links', 'wording', 'security', 'duplicateCandidates']) {
    const phaseIncludes = arrayValues(docs[phase]?.include);
    if (phaseIncludes.length > 0) {
      exceptions.push({ setting: `docs.${phase}.include`, value: phaseIncludes });
    }

    for (const value of arrayValues(docs[phase]?.exclude)) {
      if (!baseExcludes.has(value)) {
        exceptions.push({ setting: `docs.${phase}.exclude`, value });
      }
    }

    for (const value of arrayValues(docs[phase]?.skip)) {
      exceptions.push({ setting: `docs.${phase}.skip`, value });
    }
  }

  for (const [setting, values] of [
    ['docs.wording.allow', docs.wording?.allow],
    ['docs.security.allow', docs.security?.allow],
  ]) {
    for (const value of arrayValues(values)) {
      exceptions.push({ setting, value });
    }
  }

  if (docs.wording?.writeGood === false) {
    exceptions.push({ setting: 'docs.wording.writeGood', value: false });
  }

  if (docs.links?.checkFragments === false) {
    exceptions.push({ setting: 'docs.links.checkFragments', value: false });
  }

  for (const pair of arrayValues(docs.duplicateCandidates?.ignorePairs)) {
    exceptions.push({
      setting: 'docs.duplicateCandidates.ignorePairs',
      value: { left: pair?.left, right: pair?.right },
    });
  }

  for (const setting of ['minSimilarity', 'minWords', 'minChars']) {
    const value = docs.duplicateCandidates?.[setting];

    if (typeof value === 'number' && value > duplicateCandidateDefaults[setting]) {
      exceptions.push({ setting: `docs.duplicateCandidates.${setting}`, value });
    }
  }

  return exceptions.sort(compareExceptions);
}

export const collectPersistedStringExceptions = collectPersistedExceptions;

function checkAgentInstructions(content, errors) {
  const lines = content.trimEnd().split('\n');

  if (lines.length > 80) {
    errors.push(`AGENTS.md has ${lines.length} lines; keep the always-loaded entry point at 80 or fewer.`);
  }

  if (!lines.slice(0, 7).join('\n').includes('](README.md)')) {
    errors.push('AGENTS.md opening must link to README.md for project orientation.');
  }

  const sharedRules = [
    markdownSection(content, 'Shared Rules'),
    markdownSection(content, 'Skill Reference'),
  ].join('\n');
  const sourceOfTruth = markdownSection(content, 'Source Of Truth');
  const verification = markdownSection(content, 'Verification');

  if (!sharedRules.includes('](.agents/skills/agent-doc-rules/references/agents-rules.md)')) {
    errors.push(
      'AGENTS.md Shared Rules or Skill Reference must link the installed AGENTS.md rules.',
    );
  }

  const requiredSourceLinks = [
    'packages/agent-doc-rules-skill/skills/agent-doc-rules/SKILL.md',
    'packages/agent-doc-rules-skill/skills/docs-duplicate-review/SKILL.md',
    'packages/agent-doc-rules-skill/README.md',
    'docs/development.md',
    'docs/project-cleanup.md',
    'docs/release-management.md',
  ];

  for (const path of requiredSourceLinks) {
    if (!sourceOfTruth.includes(`](${path})`)) {
      errors.push(`AGENTS.md Source Of Truth must use a Markdown link to ${path}.`);
    }
  }

  const verificationTerms = [
    'Documentation only',
    'Skill layout or install behavior',
    'Runtime, validator, or E2E code',
    'Release preparation',
    'supersedes',
    'reason',
    'residual risk',
  ];

  for (const term of verificationTerms) {
    if (!verification.includes(term)) {
      errors.push(`AGENTS.md Verification must include ${term}.`);
    }
  }
}

function checkRootReadme(content, manifest, errors) {
  if (content.trimEnd().split('\n').length > 80) {
    errors.push('README.md must remain a short monorepo entry point.');
  }

  for (const path of ['packages/agent-doc-rules-skill/README.md', 'docs/development.md']) {
    if (!content.includes(`](${path})`)) {
      errors.push(`README.md must link to ${path}.`);
    }
  }

  const firstBashBlock = fencedBlocks(content, 'bash')[0] ?? '';

  for (const command of ['corepack pnpm install', 'corepack pnpm test']) {
    if (!firstBashBlock.includes(command)) {
      errors.push(`README.md first command block must include ${command}.`);
    }
  }

  if (!content.includes('corepack pnpm run docs:check')) {
    errors.push('README.md must name the documentation verification gate.');
  }

  for (const script of ['test', 'docs:check']) {
    if (!manifest.scripts?.[script]) {
      errors.push(`README.md documents ${script}, but package.json does not define it.`);
    }
  }

  for (const script of ['test', 'docs:check']) {
    if (manifest.scripts?.[script] && !scriptTransitivelyRunsSelfCompliance(manifest.scripts, script)) {
      errors.push(`package.json ${script} must run tools/check-self-compliance.mjs.`);
    }
  }
}

function checkDevelopmentGuide(content, errors) {
  if (!content.includes('corepack pnpm exec agent-doc-rules-docs init --print')) {
    errors.push('docs/development.md must use the workspace-resolved validator init command.');
  }

  for (const block of fencedBlocks(content, 'bash')) {
    if (/^agent-doc-rules-docs init(?: --print)?$/m.test(block)) {
      errors.push('docs/development.md must not expose a bare validator init command.');
    }
  }

  for (const heading of ['Repository Map', 'Maintainer Docs']) {
    if (headingCount(content, heading) !== 1) {
      errors.push(`docs/development.md must contain exactly one ${heading} section.`);
    }
  }

  if (headingCount(content, 'Canonical Docs') > 0) {
    errors.push('docs/development.md must not maintain a second canonical-docs index.');
  }
}

function checkPackageReadmes({
  validatorReadme,
  runnerReadme,
  runnerScenarioGuide,
  skillReadme,
  adoptionGuide,
  reportReadme,
  skillManifest,
  validatorManifest,
  runnerManifest,
  reportManifest,
}, errors) {
  if (validatorReadme.trimEnd().split('\n').length > 120) {
    errors.push('packages/docs-validator/README.md must stay below 121 lines.');
  }

  if (!validatorReadme.includes(
    '](../agent-doc-rules-skill/skills/agent-doc-rules/references/config-reference.md)',
  )) {
    errors.push('The validator README must link to the canonical config reference.');
  }

  if (fencedBlocks(validatorReadme, 'json').some((block) => /"docs"\s*:/.test(block))) {
    errors.push('The validator README must not maintain a second full starter config.');
  }

  if (!/record why[\s\S]{0,180}(?:remain unverified|residual risk)/i.test(validatorReadme)) {
    errors.push('The validator README must state the reason and residual risk for skipped checks.');
  }

  if (runnerReadme.trimEnd().split('\n').length > 120) {
    errors.push('packages/agent-e2e-runner/README.md must stay below 121 lines.');
  }

  const runnerTerms = [
    '## Security Boundary',
    'lifecycle scripts',
    'inherits the runner environment',
    '](docs/writing-agent-scenarios.md)',
    '](docs/reference.md)',
    '](docs/architecture.md)',
    '](../agent-e2e-report/docs/report-format.md)',
    'npx --no-install agent-e2e-runner',
  ];

  for (const term of runnerTerms) {
    if (!runnerReadme.includes(term)) {
      errors.push(`The E2E runner README must include ${term}.`);
    }
  }

  if (!/not\s+container isolation/.test(runnerReadme)) {
    errors.push('The E2E runner README must state that workspace-write is not container isolation.');
  }

  for (const manualHeading of ['CLI', 'Environment Variables', 'Agent Config', 'Library API']) {
    if (headingCount(runnerReadme, manualHeading) > 0) {
      errors.push(`The E2E runner README must link to, not own, the ${manualHeading} reference.`);
    }
  }

  const pinnedExamples = [
    [skillReadme, `${skillManifest.name}@${skillManifest.version}`, 'skill package README'],
    [adoptionGuide, `${skillManifest.name}@${skillManifest.version}`, 'adoption guide'],
    [skillReadme, `${validatorManifest.name}@${validatorManifest.version}`, 'skill package README'],
    [adoptionGuide, `${validatorManifest.name}@${validatorManifest.version}`, 'adoption guide'],
    [validatorReadme, `${validatorManifest.name}@${validatorManifest.version}`, 'validator README'],
    [runnerReadme, `${runnerManifest.name}@${runnerManifest.version}`, 'runner README'],
    [
      runnerScenarioGuide,
      `"${runnerManifest.name}": "${runnerManifest.version}"`,
      'runner scenario guide',
    ],
    [reportReadme, `${reportManifest.name}@${reportManifest.version}`, 'report README'],
  ];

  for (const [content, packageSpec, label] of pinnedExamples) {
    if (!content.includes(packageSpec)) {
      errors.push(`The ${label} must pin its install example to ${packageSpec}.`);
    }
  }

  for (const [content, label] of [
    [skillReadme, 'skill package README'],
    [adoptionGuide, 'adoption guide'],
  ]) {
    if (!content.includes('skills@1.5.12')) {
      errors.push(`The ${label} must pin the reviewed skills CLI version.`);
    }
  }
}

async function checkDecisionRecords(root, errors) {
  const decisionDir = join(root, 'docs/decisions');
  const realRoot = await realpath(root);
  const index = await readFile(join(decisionDir, 'README.md'), 'utf8');
  const records = (await readdir(decisionDir))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();

  for (const name of records) {
    const path = join(decisionDir, name);
    const content = await readFile(path, 'utf8');
    const label = relative(root, path);
    const requiredPatterns = [
      [/^# .+/m, 'title'],
      [/^Date: \d{4}-\d{2}-\d{2}$/m, 'date'],
    ];
    const requiredSections = [
      [['Context'], 'Context'],
      [['Decision'], 'Decision'],
      [['Trade-Off', 'Trade-Off And Consequences'], 'Trade-Off'],
      [['Applies To'], 'Applies To'],
      [['Revisit When'], 'Revisit When'],
    ];

    const status = content.match(/^Status: ((?:Accepted|Superseded|Archived)(?:\b[^\n]*)?)$/m)?.[1];

    if (!status) {
      errors.push(`${label} is missing required status content.`);
    }

    for (const [pattern, section] of requiredPatterns) {
      if (!pattern.test(content)) {
        errors.push(`${label} is missing required ${section} content.`);
      }
    }

    for (const [headings, section] of requiredSections) {
      const heading = headings.find((candidate) => content.split('\n').includes(`## ${candidate}`));

      if (!heading) {
        errors.push(`${label} is missing required ${section} content.`);
      } else if (markdownSection(content, heading).trim().length === 0) {
        errors.push(`${label} has empty required ${section} content.`);
      }
    }

    if (!index.includes(`](${name})`)) {
      errors.push(`docs/decisions/README.md must index ${name}.`);
    }

    if (!status?.startsWith('Accepted')) {
      continue;
    }

    const backlinkSection = markdownSection(content, 'Backlinks');

    if (!/^## Backlinks$/m.test(content)) {
      errors.push(`${label} is missing required Backlinks content.`);
    }

    const backlinks = [...backlinkSection.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)];

    if (backlinks.length === 0) {
      errors.push(`${label} must name at least one affected-surface backlink.`);
      continue;
    }

    for (const [, href] of backlinks) {
      let target;

      try {
        target = resolve(dirname(path), decodeURIComponent(href));
      } catch {
        errors.push(`${label} contains an invalid backlink target: ${href}.`);
        continue;
      }

      if (!isPathWithin(realRoot, target)) {
        errors.push(`${label} backlink target must stay inside the repository: ${href}.`);
        continue;
      }

      if (!await pathExists(target)) {
        errors.push(`${label} names a missing backlink target: ${href}.`);
        continue;
      }

      const realTarget = await realpath(target);

      if (!isPathWithin(realRoot, realTarget)) {
        errors.push(`${label} backlink target escapes the repository through a symlink: ${href}.`);
        continue;
      }

      const targetContent = await readFile(realTarget, 'utf8');

      if (!targetContent.includes(name)) {
        errors.push(`${relative(root, target)} must link back to ${label}.`);
      }
    }
  }
}

async function checkConfigExceptionGovernance(root, errors) {
  const configPath = join(root, 'agent-doc-rules.config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const actual = collectPersistedExceptions(config);
  const registered = config.governance?.exceptions;

  if (!Array.isArray(registered)) {
    errors.push('agent-doc-rules.config.json must define governance.exceptions.');
    return;
  }

  const actualKeys = new Set(actual.map(exceptionKey));
  const registeredKeys = new Set();

  for (const entry of registered) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push('Each governance.exceptions entry must be an object.');
      continue;
    }

    const { setting, value, reason, decision } = entry;
    const key = exceptionKey({ setting, value });

    if (registeredKeys.has(key)) {
      errors.push(`Duplicate governance entry for ${setting}: ${JSON.stringify(value)}.`);
    }
    registeredKeys.add(key);

    if (!actualKeys.has(key)) {
      errors.push(`Stale governance entry for ${setting}: ${JSON.stringify(value)}.`);
    }

    if (typeof reason !== 'string' || reason.trim().length < 24) {
      errors.push(`Governance entry ${setting} needs a concrete reason.`);
    }

    if (!/^docs\/decisions\/[a-z0-9-]+\.md$/.test(decision ?? '')) {
      errors.push(`Governance entry ${setting} needs a repo-relative decision record.`);
    } else if (!await pathExists(join(root, decision))) {
      errors.push(`Governance entry ${setting} links to missing ${decision}.`);
    }
  }

  const decisionPaths = new Set(registered
    .map((entry) => entry?.decision)
    .filter((decision) => /^docs\/decisions\/[a-z0-9-]+\.md$/.test(decision ?? '')));

  for (const decision of decisionPaths) {
    const decisionPath = join(root, decision);

    if (!await pathExists(decisionPath)) {
      continue;
    }

    const content = await readFile(decisionPath, 'utf8');

    if (!/^Status: Accepted(?:\b[^\n]*)?$/m.test(content)) {
      errors.push(`Governance decision ${decision} must have Accepted status.`);
    }

    const backlinks = [...markdownSection(content, 'Backlinks')
      .matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)];
    const linksConfig = backlinks.some(([, href]) => {
      try {
        return resolve(dirname(decisionPath), decodeURIComponent(href)) === configPath;
      } catch {
        return false;
      }
    });

    if (!linksConfig) {
      errors.push(
        `Governance decision ${decision} must backlink agent-doc-rules.config.json.`,
      );
    }
  }

  for (const entry of actual) {
    if (!registeredKeys.has(exceptionKey(entry))) {
      errors.push(`Unregistered config exception ${entry.setting}: ${JSON.stringify(entry.value)}.`);
    }
  }

  const customSharedExcludes = arrayValues(config.docs?.exclude)
    .filter((value) => !defaultExclude.includes(value));

  for (const phase of ['markdown', 'links', 'wording', 'security', 'duplicateCandidates']) {
    const phaseExcludes = arrayValues(config.docs?.[phase]?.exclude);

    if (phaseExcludes.length === 0) {
      continue;
    }

    for (const value of customSharedExcludes) {
      if (!phaseExcludes.includes(value)) {
        errors.push(
          `docs.${phase}.exclude must repeat shared exclusion ${JSON.stringify(value)}; `
          + 'phase excludes replace rather than extend docs.exclude.',
        );
      }
    }
  }

  for (const pattern of arrayValues(config.docs?.links?.skip)) {
    if (isBroadLinkSkip(pattern)) {
      errors.push(`Link skip pattern is too broad: ${pattern}.`);
    }
  }

  const ignorePairs = config.docs?.duplicateCandidates?.ignorePairs ?? [];

  if (!Array.isArray(ignorePairs)) {
    errors.push('docs.duplicateCandidates.ignorePairs must be an array.');
    return;
  }

  for (const pair of ignorePairs) {
    if (!isNarrowAnchoredPattern(pair?.left)) {
      errors.push(`ignorePairs left pattern must be narrow and anchored: ${pair.left}.`);
    }
    if (!isNarrowAnchoredPattern(pair?.right)) {
      errors.push(`ignorePairs right pattern must be narrow and anchored: ${pair.right}.`);
    }
    if (typeof pair?.reason !== 'string' || pair.reason.trim().length === 0) {
      errors.push('Every ignorePairs entry must include a reason.');
    }
  }
}

function arrayValues(value) {
  return Array.isArray(value) ? value : [];
}

function sameStringSet(left, right) {
  return left.length === right.length
    && left.every((value) => right.includes(value))
    && right.every((value) => left.includes(value));
}

function scriptTransitivelyRunsSelfCompliance(scripts, entryScript, visited = new Set()) {
  if (visited.has(entryScript)) {
    return false;
  }

  visited.add(entryScript);
  const script = scripts[entryScript];

  if (typeof script !== 'string') {
    return false;
  }

  if (/[|&;]/.test(script.replaceAll('&&', ''))) {
    return false;
  }

  for (const segment of script.split(/\s*&&\s*/)) {
    const tokens = shellTokens(segment);

    if (tokens[0] === 'node' && tokens[1] === 'tools/check-self-compliance.mjs') {
      return true;
    }

    for (let index = 0; index < tokens.length - 2; index += 1) {
      if (
        ['npm', 'pnpm', 'yarn'].includes(tokens[index])
        && tokens[index + 1] === 'run'
        && scriptTransitivelyRunsSelfCompliance(scripts, tokens[index + 2], visited)
      ) {
        return true;
      }
    }
  }

  return false;
}

function shellTokens(command) {
  return [...command.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)]
    .map((match) => match[1] ?? match[2] ?? match[3]);
}

function isNarrowAnchoredPattern(pattern) {
  if (
    typeof pattern !== 'string'
    || pattern.length <= 2
    || !pattern.startsWith('^')
    || !hasUnescapedTrailingDollar(pattern)
    || !/^(?:[a-z0-9_/-]|\\\.)+$/i.test(pattern.slice(1, -1))
  ) {
    return false;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function hasUnescapedTrailingDollar(pattern) {
  if (!pattern.endsWith('$')) {
    return false;
  }

  let backslashes = 0;
  for (let index = pattern.length - 2; index >= 0 && pattern[index] === '\\'; index -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 0;
}

function isBroadLinkSkip(pattern) {
  if (typeof pattern !== 'string') {
    return true;
  }

  try {
    new RegExp(pattern);
    return !/^\^https(?:\?)?:\/\/[a-z0-9-]+(?:\\\.[a-z0-9-]+)+(?:\(\?:\/\|\$\)|\$)$/i
      .test(pattern);
  } catch {
    return true;
  }
}

function markdownSection(content, heading) {
  const lines = content.split('\n');
  const start = lines.findIndex((line) => line === `## ${heading}`);

  if (start < 0) {
    return '';
  }

  const endOffset = lines.slice(start + 1).findIndex((line) => /^## /.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join('\n');
}

function fencedBlocks(content, language) {
  const pattern = new RegExp('^```' + language + '\\n([\\s\\S]*?)^```$', 'gm');
  return [...content.matchAll(pattern)].map((match) => match[1]);
}

function headingCount(content, heading) {
  return content.split('\n').filter((line) => line === `## ${heading}`).length;
}

function exceptionKey({ setting, value }) {
  return `${setting}\u0000${JSON.stringify(value)}`;
}

function compareExceptions(left, right) {
  return exceptionKey(left).localeCompare(exceptionKey(right));
}

function isPathWithin(root, target) {
  const path = relative(root, target);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function pathExists(path) {
  return Boolean(await stat(path).catch(() => undefined));
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const errors = await checkRepositorySelfCompliance();

  if (errors.length > 0) {
    console.error('Repository self-compliance check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  } else {
    console.log('Repository self-compliance check passed.');
  }
}
