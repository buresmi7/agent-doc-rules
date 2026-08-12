export default {
  skillsCliVersion: '1.5.12',
  judgePrompt: './prompts/judge-agents.md',
  tempPrefix: 'agent-doc-rules',
  inspectLinks: {
    triageDoc: 'docs/e2e-failure-triage.md',
    ruleMatrix: 'docs/e2e-rule-matrix.md',
    rulePlacement: 'docs/rule-placement.md',
  },
  projectFileOptions: {
    evidenceFileNames: ['package.json', 'agent-doc-rules.config.json'],
  },
};
