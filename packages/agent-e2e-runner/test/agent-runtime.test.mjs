import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildCodexAgentArgs,
  buildCodexJudgeArgs,
  buildCodexProcessEnv,
  createCodexSession,
  extractCodexActivity,
  parseCodexJsonEvents,
  prepareIsolatedCodexHome,
  summarizeCodexCommand,
} from '../src/agent-runtime.mjs';

const runtime = {
  codexBin: 'codex',
  codexModel: 'gpt-test',
  codexReasoningEffort: 'medium',
  codexJudgeModel: 'gpt-test-judge',
  codexJudgeReasoningEffort: 'low',
};

test('buildCodexAgentArgs starts a writable persistent Codex session', () => {
  const args = buildCodexAgentArgs(runtime, {
    outputFile: '/tmp/response.txt',
    cwd: '/tmp/project',
  });

  assert.deepEqual(args.slice(0, 8), [
    'exec',
    '--skip-git-repo-check',
    '--ignore-rules',
    '--sandbox',
    'workspace-write',
    '--add-dir',
    '/tmp/project/.agents',
    '--json',
  ]);
  assert.deepEqual(args.slice(-3), ['--cd', '/tmp/project', '-']);
  assert.ok(args.includes('--output-last-message'));
  assert.ok(args.includes('gpt-test'));
  assert.ok(args.includes('model_reasoning_effort="medium"'));
  assert.ok(!args.includes('--ephemeral'));
  assert.ok(!args.includes('--output-schema'));
});

test('buildCodexAgentArgs resumes the same session', () => {
  const args = buildCodexAgentArgs(runtime, {
    outputFile: '/tmp/response.txt',
    cwd: '/tmp/project',
    sessionId: 'thread-123',
  });

  assert.deepEqual(args.slice(0, 3), ['exec', 'resume', '--skip-git-repo-check']);
  assert.deepEqual(args.slice(-2), ['thread-123', '-']);
  assert.ok(!args.includes('--cd'));
  assert.ok(!args.includes('--sandbox'));
});

test('buildCodexJudgeArgs keeps the judge ephemeral and read-only', () => {
  const args = buildCodexJudgeArgs(runtime, {
    schemaFile: '/tmp/schema.json',
    outputFile: '/tmp/output.json',
    cwd: '/tmp/project',
  });

  assert.ok(args.includes('--ephemeral'));
  assert.deepEqual(args.slice(args.indexOf('--sandbox'), args.indexOf('--sandbox') + 2), [
    '--sandbox',
    'read-only',
  ]);
  assert.ok(args.includes('--output-schema'));
  assert.ok(args.includes('gpt-test-judge'));
  assert.ok(args.includes('model_reasoning_effort="low"'));
});

test('parseCodexJsonEvents reads the session and final assistant message', () => {
  const parsed = parseCodexJsonEvents([
    JSON.stringify({ type: 'thread.started', thread_id: 'thread-123' }),
    JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: '/bin/bash -lc "npm test"',
        exit_code: 0,
        status: 'completed',
      },
    }),
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Which Jane?' },
    }),
  ].join('\n'));

  assert.equal(parsed.threadId, 'thread-123');
  assert.equal(parsed.lastAgentMessage, 'Which Jane?');
});

test('extractCodexActivity keeps auditable tool facts without command output', () => {
  assert.deepEqual(extractCodexActivity([
    {
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: '/bin/bash -lc "npm test"',
        aggregated_output: 'all tests passed\n',
        exit_code: 0,
        status: 'completed',
      },
    },
    {
      type: 'item.completed',
      item: {
        type: 'file_change',
        changes: [{ path: '/tmp/project/README.md', kind: 'update' }],
        status: 'completed',
      },
    },
    {
      type: 'item.completed',
      item: { type: 'agent_message', text: 'Done.' },
    },
  ]), [
    {
      type: 'command_execution',
      commandSummary: 'npm test',
      exitCode: 0,
      status: 'completed',
    },
    {
      type: 'file_change',
      status: 'completed',
      changes: [{ path: '/tmp/project/README.md', kind: 'update' }],
    },
  ]);
});

test('summarizeCodexCommand keeps verification names without shell arguments', () => {
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm run docs:check\''),
    'npm run docs:check',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'python3 /tmp/quick_validate.py .agents/skills/example\''),
    'python3',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'python3 /tmp/quick_validate.py\''),
    'python3 quick_validate.py',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'rg -n "Blue Finch|fake-token" .\''),
    'rg',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'PRIVATE_VALUE=do-not-store custom-check\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'echo "npm test"\''),
    'echo',
  );
  assert.equal(
    summarizeCodexCommand(
      '/bin/bash -lc \'npm test && npm run docs:check && git diff -- README.md\'',
    ),
    'npm test && npm run docs:check',
  );
  assert.equal(
    summarizeCodexCommand(
      '/bin/bash -lc \'corepack pnpm test && corepack pnpm run docs:check\'',
    ),
    'pnpm test && pnpm run docs:check',
  );
  assert.equal(
    summarizeCodexCommand(
      '/bin/bash -lc \'git diff -- README.md package.json && npm test && npm run docs:check\'',
    ),
    'npm test && npm run docs:check',
  );
  assert.equal(
    summarizeCodexCommand(
      '/bin/bash -lc \'git status --short -- README.md && node --test\'',
    ),
    'node --test',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'echo "safe && npm run docs:check"\''),
    'echo',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test || true\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm testing\''),
    'npm',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'node --test-reporter=spec --version\''),
    'node',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'node --title=private-token-value -e "0"\''),
    'node',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'python3 --password=private-token-value\''),
    'python3',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'python3 /tmp/quick_validate.py''-noop'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'npx vitest''-noop'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'python3 /tmp/quick_validate.py\\ -noop'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'npx vitest\\ -noop'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'FOO=bar\\ npm test 1 = 1'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'git\\ -fake'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npx --package=private-token-value\''),
    'npx',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npx vitest\''),
    'npx vitest',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'npm''-noop test'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'npm\u00a0test'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test | tee test.log\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test & true\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test\nnpm run docs:check\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test &&\nnpm run docs:check\''),
    'npm test && npm run docs:check',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test &>/tmp/private-token-value && npm run docs:check\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test &>>/tmp/private-token-value\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test >| /tmp/private-token-value\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test # skipped && npm run docs:check\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'cat <<EOF\nnpm test && npm run docs:check\nEOF\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'(npm test && npm run docs:check)\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'echo "$(npm test && npm run docs:check)"\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'echo `npm test`\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc `npm test && npm run docs:check`'),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'[[ -n value || npm test ]]\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("echo $'npm test && npm run docs:check'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc npm test'),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc python3 private-token-value'),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test\' ignored'),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("FOO='bar npm test ' true"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("FOO='bar corepack pnpm test ' true"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test --help\''),
    'npm',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm run docs:check --help\''),
    'npm',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm_config_script_shell=/bin/true npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'if false\nthen\nnpm test\nfi\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'while false\ndo\nnpm run docs:check\ndone\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'exit 0 && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'true && exec true && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'set -n && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'hash -p /bin/true npm && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'export npm_config_script_shell=/bin/true && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'cd /tmp && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'git diff --output=/tmp/result && npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'npm test && export npm_config_script_shell=/bin/true && npm run docs:check\''),
    'npm test',
  );
  assert.equal(
    summarizeCodexCommand('/bin/bash -lc \'true || npm test\''),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'npm test\rtrue'"),
    'shell command',
  );
  assert.equal(
    summarizeCodexCommand("/bin/bash -lc 'npm test\r\ntrue'"),
    'shell command',
  );
});

test('createCodexSession sends later turns through codex exec resume', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-e2e-codex-session-'));
  const sourceCodexHome = join(root, 'source-codex-home');
  const calls = [];

  await mkdir(sourceCodexHome);
  await writeFile(join(sourceCodexHome, 'auth.json'), '{"token":"test"}\n');

  const session = await createCodexSession({
    ...runtime,
    codexConfigHome: sourceCodexHome,
  }, {
    cwd: root,
    outputDir: join(root, 'session-output'),
    baseEnv: { PATH: '/bin' },
    runProcess: async (_command, args, input, options) => {
      calls.push({ args, input, options });
      const message = calls.length === 1 ? 'Which Jane?' : 'Added Jane A.';

      return {
        code: 0,
        stdout: [
          JSON.stringify({ type: 'thread.started', thread_id: 'thread-123' }),
          JSON.stringify({
            type: 'item.completed',
            item: { type: 'agent_message', text: message },
          }),
        ].join('\n'),
        stderr: '',
      };
    },
  });

  const firstTurn = await session.runTurn('Call Jane.');

  assert.equal(firstTurn.response, 'Which Jane?');
  assert.deepEqual(firstTurn.activity, []);
  assert.equal((await session.runTurn('Jane A.')).response, 'Added Jane A.');
  assert.equal(session.sessionId, 'thread-123');
  assert.ok(!calls[0].args.includes('resume'));
  assert.deepEqual(calls[1].args.slice(0, 2), ['exec', 'resume']);
  assert.equal(calls[1].input, 'Jane A.');
  assert.match(calls[0].options.env.CODEX_HOME, /session-output\/codex-home$/);
  assert.equal(
    await readFile(join(root, 'session-output/codex-home/auth.json'), 'utf8'),
    '{"token":"test"}\n',
  );

  await session.close();
  await assert.rejects(
    () => access(join(root, 'session-output/codex-home/auth.json')),
    /ENOENT/,
  );
});

test('prepareIsolatedCodexHome copies auth without copying local config or rules', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'agent-e2e-codex-home-'));
  const sourceCodexHome = join(tempDir, 'source-codex-home');

  await mkdir(sourceCodexHome, { recursive: true });
  await writeFile(join(sourceCodexHome, 'auth.json'), '{"token":"test"}\n');
  await writeFile(join(sourceCodexHome, 'config.toml'), 'model = "local-model"\n');
  await writeFile(join(sourceCodexHome, 'AGENTS.md'), '# Local maintainer rules\n');

  const isolatedCodexHome = await prepareIsolatedCodexHome({
    tempDir,
    sourceCodexHome,
    codexModel: 'gpt-test',
    sandboxMode: 'workspace-write',
  });

  assert.equal(await readFile(join(isolatedCodexHome, 'auth.json'), 'utf8'), '{"token":"test"}\n');

  const isolatedConfig = await readFile(join(isolatedCodexHome, 'config.toml'), 'utf8');
  assert.match(isolatedConfig, /model = "gpt-test"/);
  assert.match(isolatedConfig, /sandbox_mode = "workspace-write"/);
  assert.match(
    isolatedConfig,
    /project_root_markers = \["package\.json", "pnpm-workspace\.yaml"\]/,
  );
  assert.doesNotMatch(isolatedConfig, /local-model/);

  await assert.rejects(
    () => access(join(isolatedCodexHome, 'AGENTS.md')),
    /ENOENT/,
  );
});

test('buildCodexProcessEnv points Codex at the isolated home', () => {
  const env = buildCodexProcessEnv({ CODEX_HOME: '/old', PATH: '/bin' }, '/isolated');

  assert.equal(env.CODEX_HOME, '/isolated');
  assert.equal(env.PATH, '/bin');
  assert.equal(env.NO_COLOR, '1');
});
