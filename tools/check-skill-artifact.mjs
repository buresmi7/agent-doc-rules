import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = join(repoRoot, 'packages/agent-doc-rules-skill');
const expectedSkillName = 'agent-doc-rules';
const errors = [];

await assertFile(join(skillDir, 'SKILL.md'));
await assertFile(join(skillDir, 'README.md'));

await checkSkillFrontmatter();
await checkPackageFiles();
await checkOpenAiMetadata();
await checkMarkdownLinks();
await checkSkillReadmeFeatureGuide();
await checkFactualReviewContract();
await checkForbiddenText();

if (errors.length > 0) {
  console.error('Skill artifact check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Skill artifact check passed.');

async function checkSkillFrontmatter() {
  const skillPath = join(skillDir, 'SKILL.md');
  const content = await readFile(skillPath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (!match) {
    errors.push('SKILL.md must start with YAML frontmatter.');
    return;
  }

  const keys = [];
  const values = new Map();

  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':');

    if (!key || rest.length === 0) {
      errors.push(`Invalid SKILL.md frontmatter line: ${line}`);
      continue;
    }

    keys.push(key);
    values.set(key, rest.join(':').trim());
  }

  const allowed = ['name', 'description'];
  const unexpected = keys.filter((key) => !allowed.includes(key));

  if (unexpected.length > 0) {
    errors.push(`SKILL.md frontmatter has unexpected keys: ${unexpected.join(', ')}`);
  }

  if (values.get('name') !== expectedSkillName) {
    errors.push(`SKILL.md name must be ${expectedSkillName}.`);
  }

  const description = values.get('description') ?? '';

  if (!description.includes('AGENTS.md') || !description.includes('README.md')) {
    errors.push('SKILL.md description must mention AGENTS.md and README.md trigger surfaces.');
  }

  if (!description.includes('do not use as a general product-doc writer')) {
    errors.push('SKILL.md description must state the product-doc boundary.');
  }

  if (!content.includes('When creating a nested `AGENTS.md`')) {
    errors.push('SKILL.md must keep nested AGENTS.md root-pointer guidance always loaded.');
  }

  if (!content.includes('brief project orientation')) {
    errors.push('SKILL.md must keep root AGENTS.md project orientation guidance always loaded.');
  }

  if (!content.includes('real customer names, emails, account IDs, private host')) {
    errors.push('SKILL.md must explicitly name sensitive documentation categories.');
  }

  if (!content.includes('do not add generic setup, install, test')) {
    errors.push('SKILL.md must keep unsupported generic setup-step guidance always loaded.');
  }

  if (!content.includes('reason, rationale, why, or') || !content.includes('README as the only')) {
    errors.push('SKILL.md must keep notes-triage rationale placement guidance always loaded.');
  }
}

async function checkPackageFiles() {
  const packageJson = JSON.parse(await readFile(join(skillDir, 'package.json'), 'utf8'));
  const requiredFiles = ['README.md', 'SKILL.md', 'agents', 'assets', 'docs', 'references'];

  for (const file of requiredFiles) {
    if (!packageJson.files?.includes(file)) {
      errors.push(`package.json files must include ${file}.`);
    }

    await assertPath(join(skillDir, file));
  }
}

async function checkOpenAiMetadata() {
  const metadata = await readFile(join(skillDir, 'agents/openai.yaml'), 'utf8');

  if (!metadata.includes('$agent-doc-rules')) {
    errors.push('agents/openai.yaml default_prompt must mention $agent-doc-rules.');
  }
}

async function checkMarkdownLinks() {
  const markdownFiles = await findFiles(skillDir, (path) => extname(path) === '.md');

  for (const file of markdownFiles) {
    const content = stripFencedCodeBlocks(await readFile(file, 'utf8'));
    const links = content.matchAll(/\[[^\]\n]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g);

    for (const link of links) {
      const href = link[1];

      if (isExternalOrAnchor(href)) {
        continue;
      }

      const target = decodeURIComponent(href.split('#')[0]);

      if (!target) {
        continue;
      }

      await assertPath(join(dirname(file), target), `${relative(repoRoot, file)} links to missing ${href}`);
    }
  }
}

async function checkSkillReadmeFeatureGuide() {
  const readme = await readFile(join(skillDir, 'README.md'), 'utf8');

  if (!readme.includes('## Feature Guide')) {
    errors.push('Skill README must include a Feature Guide section.');
  }

  if (readme.includes('## Package Contents')) {
    errors.push('Skill README should use Feature Guide instead of Package Contents.');
  }

  const expectedFeatureLinks = [
    '[Agent Instructions](#agent-instructions)',
    '[README Shaping](#readme-shaping)',
    '[Documentation Placement](#documentation-placement)',
    '[Documentation Repair](#documentation-repair)',
    '[Factual Documentation Review](#factual-documentation-review)',
    '[Plain-English Cleanup](#plain-english-cleanup)',
    '[Validation Tools](#validation-tools)',
    '[Starter Templates](#starter-templates)',
  ];

  for (const link of expectedFeatureLinks) {
    if (!readme.includes(link)) {
      errors.push(`Skill README Feature Guide must link to ${link}.`);
    }
  }

  const expectedReferenceLinks = [
    'references/agents-rules.md',
    'references/agents-rubric.md',
    'references/doc-audit.md',
    'references/readme-rules.md',
    'references/readme-rubric.md',
    'references/documentation-architecture.md',
    'references/factual-review.md',
    'references/writing-style.md',
    'references/validation.md',
    'assets/templates/',
    'docs/context-placement.md',
  ];

  for (const path of expectedReferenceLinks) {
    if (!readme.includes(`](${path})`)) {
      errors.push(`Skill README Feature Guide must link to ${path}.`);
    }
  }
}

async function checkFactualReviewContract() {
  const skill = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
  const reference = await readFile(join(skillDir, 'references/factual-review.md'), 'utf8');
  const readme = await readFile(join(skillDir, 'README.md'), 'utf8');

  const routingTerms = [
    'factual accuracy',
    'contradictions',
    'unsupported claims',
    'misleading documentation review',
    'references/factual-review.md',
  ];

  for (const term of routingTerms) {
    if (!skill.includes(term)) {
      errors.push(`SKILL.md factual-review routing must mention ${term}.`);
    }
  }

  const requiredReferenceTerms = [
    '## Evidence Rules',
    '## Detection Pass',
    '## Finding Types',
    '## Severity',
    '## Report Format',
    'false|contradiction|unsupported|misleading|stale-risk|overclaim',
    'fail|warn|note',
    'Claim:',
    'Evidence:',
    'Impact:',
    'Fix:',
    'Confidence: confirmed|likely|needs maintainer confirmation',
    'Do not apply a requested documentation change when local evidence contradicts',
  ];

  for (const term of requiredReferenceTerms) {
    if (!reference.includes(term)) {
      errors.push(`factual-review.md must include ${term}.`);
    }
  }

  if (!readme.includes('factual accuracy, contradictions')) {
    errors.push('Skill README must include factual-review usage language.');
  }

  if (!skill.includes('local manifests support them')) {
    errors.push('SKILL.md must block unsupported generic workflow additions.');
  }
}

async function checkForbiddenText() {
  const files = await findFiles(skillDir, (path) => ['.md', '.yaml', '.json'].includes(extname(path)));
  const forbiddenPatterns = [
    { pattern: /\bTODO\b/i, message: 'TODO marker' },
    { pattern: /rules\/readme\.md/, message: 'stale rules/readme.md path' },
    { pattern: /agents-md\.md/, message: 'stale agents-md.md path' },
    { pattern: /references\/readme\.md/, message: 'stale references/readme.md path' },
  ];

  for (const file of files) {
    const content = await readFile(file, 'utf8');

    for (const { pattern, message } of forbiddenPatterns) {
      if (pattern.test(content)) {
        errors.push(`${relative(repoRoot, file)} contains ${message}.`);
      }
    }
  }
}

async function findFiles(root, predicate) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findFiles(path, predicate));
    } else if (entry.isFile() && predicate(path)) {
      files.push(path);
    }
  }

  return files;
}

async function assertFile(path) {
  const info = await stat(path).catch(() => undefined);

  if (!info?.isFile()) {
    errors.push(`Expected file does not exist: ${relative(repoRoot, path)}`);
  }
}

async function assertPath(path, message = `Expected path does not exist: ${relative(repoRoot, path)}`) {
  const info = await stat(path).catch(() => undefined);

  if (!info) {
    errors.push(message);
  }
}

function isExternalOrAnchor(href) {
  return href.startsWith('#')
    || /^[a-z][a-z0-9+.-]*:/i.test(href);
}

function stripFencedCodeBlocks(content) {
  return content.replace(/^```[\s\S]*?^```/gm, '');
}
