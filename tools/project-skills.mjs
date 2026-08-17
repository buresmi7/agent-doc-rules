import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const skillsCliVersion = process.env.SKILLS_CLI_VERSION ?? '1.5.12';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPackagePath = join(repoRoot, 'packages/agent-doc-rules-skill/package.json');
const skillPackageManifest = JSON.parse(readFileSync(skillPackagePath, 'utf8'));
const configuredLocalSkills = skillPackageManifest.agentDocRules?.localSkills ?? [];
const configuredNodeModulesSkills = skillPackageManifest.agentDocRules?.projectSkills ?? [];
const skillPackageDependencies = {
  ...skillPackageManifest.dependencies,
  ...skillPackageManifest.devDependencies,
  ...skillPackageManifest.optionalDependencies,
};
const skillsLockPath = join(repoRoot, 'skills-lock.json');
const skillsLock = JSON.parse(readFileSync(skillsLockPath, 'utf8'));

export const localWorkspaceSkills = configuredLocalSkills.map((name) => ({
  name,
  packageName: skillPackageManifest.name,
  relativeDirectory: `skills/${name}`,
}));

export const externalProjectSkills = Object.entries(skillsLock.skills ?? {})
  .filter(([, entry]) => entry.sourceType !== 'local')
  .map(([name, entry]) => ({
    name,
    source: entry.source,
    sourceType: entry.sourceType,
    skillPath: entry.skillPath,
    computedHash: entry.computedHash,
    revision: entry.revision,
  }));

assertProjectSkillManifest();

export const nodeModulesProjectSkills = configuredNodeModulesSkills.map((skill) => {
  const entry = skillsLock.skills?.[skill.name];

  return {
    name: skill.name,
    source: skill.source,
    sourceType: 'node_modules',
    computedHash: entry?.computedHash,
  };
});

export const externalProjectSkillSources = groupExternalProjectSkills();

function assertProjectSkillManifest() {
  if (!skillPackageManifest.name) {
    throw new Error(`${skillPackagePath} must define name`);
  }

  if (externalProjectSkills.length === 0) {
    throw new Error(`${skillsLockPath} must define external project skills`);
  }

  assertConfiguredLocalSkills();
  assertConfiguredNodeModulesSkills();

  for (const skill of externalProjectSkills) {
    if (!skill.source || !skill.sourceType || !skill.computedHash) {
      throw new Error(`Invalid project skill lock entry for ${skill.name} in ${skillsLockPath}`);
    }

    if (skill.revision && (skill.sourceType !== 'github' || !/^[0-9a-f]{40}$/.test(skill.revision))) {
      throw new Error(`Invalid project skill revision for ${skill.name} in ${skillsLockPath}`);
    }

    if (skill.sourceType === 'node_modules') {
      assertNodeModulesSkillIsConfigured(skill);
    } else if (!skill.skillPath) {
      throw new Error(`Invalid project skill lock entry for ${skill.name} in ${skillsLockPath}`);
    }
  }
}

function assertConfiguredLocalSkills() {
  if (configuredLocalSkills.length === 0) {
    throw new Error(`${skillPackagePath} agentDocRules.localSkills must not be empty`);
  }

  const names = new Set();

  for (const name of configuredLocalSkills) {
    if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`${skillPackagePath} contains invalid local skill name ${JSON.stringify(name)}`);
    }

    if (names.has(name)) {
      throw new Error(`${skillPackagePath} declares duplicate local skill ${name}`);
    }
    names.add(name);

    const entry = skillsLock.skills?.[name];
    const expectedSource = `packages/agent-doc-rules-skill/skills/${name}`;

    if (!entry) {
      throw new Error(`${skillsLockPath} must define local workspace skill ${name}`);
    }

    if (entry.sourceType !== 'local' || entry.source !== expectedSource) {
      throw new Error(`${name} must use local source ${expectedSource} in ${skillsLockPath}`);
    }
  }

  const lockedLocalNames = Object.entries(skillsLock.skills ?? {})
    .filter(([, entry]) => entry.sourceType === 'local')
    .map(([name]) => name)
    .sort();
  const configuredNames = [...names].sort();

  if (
    lockedLocalNames.length !== configuredNames.length
    || lockedLocalNames.some((name, index) => name !== configuredNames[index])
  ) {
    throw new Error(
      `${skillsLockPath} local entries must exactly match agentDocRules.localSkills: `
      + configuredNames.join(', '),
    );
  }
}

function groupExternalProjectSkills() {
  const sources = new Map();

  for (const skill of externalProjectSkills.filter((entry) => entry.sourceType !== 'node_modules')) {
    const key = `${skill.sourceType}:${skill.source}:${skill.revision ?? ''}`;

    if (!sources.has(key)) {
      sources.set(key, {
        source: skill.source,
        sourceType: skill.sourceType,
        revision: skill.revision,
        skills: [],
      });
    }

    sources.get(key).skills.push({
      name: skill.name,
      skillPath: skill.skillPath,
      computedHash: skill.computedHash,
    });
  }

  return [...sources.values()];
}

function assertConfiguredNodeModulesSkills() {
  const names = new Set();

  for (const skill of configuredNodeModulesSkills) {
    if (!skill?.name || !skill?.source) {
      throw new Error(`${skillPackagePath} agentDocRules.projectSkills entries must define name and source`);
    }

    if (names.has(skill.name)) {
      throw new Error(`${skillPackagePath} declares duplicate project skill ${skill.name}`);
    }

    if (!skillPackageDependencies[skill.source]) {
      throw new Error(`${skillPackagePath} must depend on ${skill.source} for project skill ${skill.name}`);
    }

    names.add(skill.name);

    const entry = skillsLock.skills?.[skill.name];

    if (!entry) {
      throw new Error(`${skillsLockPath} must lock configured project skill ${skill.name}`);
    }

    if (entry.sourceType !== 'node_modules') {
      throw new Error(`${skill.name} must use sourceType node_modules in ${skillsLockPath}`);
    }

    if (entry.source !== skill.source) {
      throw new Error(`${skill.name} source mismatch: ${skill.source} in ${skillPackagePath}, ${entry.source} in ${skillsLockPath}`);
    }
  }
}

function assertNodeModulesSkillIsConfigured(skill) {
  const configured = configuredNodeModulesSkills.find((entry) => entry.name === skill.name);

  if (!configured) {
    throw new Error(`${skillsLockPath} contains node_modules project skill ${skill.name}, but ${skillPackagePath} does not declare it`);
  }

  if (configured.source !== skill.source) {
    throw new Error(`${skill.name} source mismatch: ${configured.source} in ${skillPackagePath}, ${skill.source} in ${skillsLockPath}`);
  }
}
