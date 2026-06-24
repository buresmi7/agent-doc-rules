import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const skillsCliVersion = process.env.SKILLS_CLI_VERSION ?? '1.5.12';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillPackagePath = join(repoRoot, 'packages/agent-doc-rules-skill/package.json');
const skillPackageManifest = JSON.parse(readFileSync(skillPackagePath, 'utf8'));
const configuredNodeModulesSkills = skillPackageManifest.agentDocRules?.projectSkills ?? [];
const skillPackageDependencies = {
  ...skillPackageManifest.dependencies,
  ...skillPackageManifest.devDependencies,
  ...skillPackageManifest.optionalDependencies,
};
const skillsLockPath = join(repoRoot, 'skills-lock.json');
const skillsLock = JSON.parse(readFileSync(skillsLockPath, 'utf8'));
const localSkill = findLocalWorkspaceSkill();

export const localWorkspaceSkill = {
  name: localSkill.name,
  packageName: skillPackageManifest.name,
};

export const externalProjectSkills = Object.entries(skillsLock.skills ?? {})
  .filter(([, entry]) => entry.sourceType !== 'local')
  .map(([name, entry]) => ({
    name,
    source: entry.source,
    sourceType: entry.sourceType,
    skillPath: entry.skillPath,
    computedHash: entry.computedHash,
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
  if (!localWorkspaceSkill.packageName) {
    throw new Error(`${skillPackagePath} must define name`);
  }

  if (!skillsLock.skills?.[localWorkspaceSkill.name]) {
    throw new Error(`${skillsLockPath} must define the local workspace skill`);
  }

  if (externalProjectSkills.length === 0) {
    throw new Error(`${skillsLockPath} must define external project skills`);
  }

  assertConfiguredNodeModulesSkills();

  for (const skill of externalProjectSkills) {
    if (!skill.source || !skill.sourceType || !skill.computedHash) {
      throw new Error(`Invalid project skill lock entry for ${skill.name} in ${skillsLockPath}`);
    }

    if (skill.sourceType === 'node_modules') {
      assertNodeModulesSkillIsConfigured(skill);
    } else if (!skill.skillPath) {
      throw new Error(`Invalid project skill lock entry for ${skill.name} in ${skillsLockPath}`);
    }
  }
}

function findLocalWorkspaceSkill() {
  const localEntry = Object.entries(skillsLock.skills ?? {}).find(([, entry]) =>
    entry.sourceType === 'local' && entry.source === 'packages/agent-doc-rules-skill'
  );

  if (!localEntry) {
    throw new Error(`${skillsLockPath} must contain a local packages/agent-doc-rules-skill entry`);
  }

  const [name, entry] = localEntry;

  return { name, ...entry };
}

function groupExternalProjectSkills() {
  const sources = new Map();

  for (const skill of externalProjectSkills.filter((entry) => entry.sourceType !== 'node_modules')) {
    const key = `${skill.sourceType}:${skill.source}`;

    if (!sources.has(key)) {
      sources.set(key, {
        source: skill.source,
        sourceType: skill.sourceType,
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
