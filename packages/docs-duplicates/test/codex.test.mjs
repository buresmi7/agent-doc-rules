import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import * as codex from '../src/codex.mjs';

const minimumVersion = '0.142.0';

test('an explicit compatible Codex executable wins without fallback probes', () => {
  const probes = [];
  let localResolutionCount = 0;

  const executable = codex.resolveCodexExecutable(
    { codexBin: '/explicit/codex' },
    {
      probeCodex(candidate) {
        probes.push(candidate);
        return compatibleProbe('0.144.5');
      },
      resolveLocalCodex() {
        localResolutionCount += 1;
        return localCandidate();
      },
    },
  );

  assert.equal(executable.command, '/explicit/codex');
  assert.deepEqual(executable.args, []);
  assert.deepEqual(probes, [{ command: '/explicit/codex', args: [] }]);
  assert.equal(localResolutionCount, 0);
});

test('a missing explicit Codex executable fails without fallback probes', () => {
  const probes = [];
  let localResolutionCount = 0;

  assert.throws(
    () => codex.resolveCodexExecutable(
      { codexBin: '/missing/codex' },
      {
        probeCodex(candidate) {
          probes.push(candidate);
          return missingProbe(candidate.command);
        },
        resolveLocalCodex() {
          localResolutionCount += 1;
          return localCandidate();
        },
      },
    ),
    (error) => {
      assert.match(error.message, /explicit/i);
      assert.match(error.message, /\/missing\/codex/);
      assert.match(error.message, /not found|could not (?:be )?run/i);
      return true;
    },
  );

  assert.deepEqual(probes, [{ command: '/missing/codex', args: [] }]);
  assert.equal(localResolutionCount, 0);
});

test('an incompatible explicit Codex executable fails without fallback probes', () => {
  let localResolutionCount = 0;

  assert.throws(
    () => codex.resolveCodexExecutable(
      { codexBin: '/old/codex' },
      {
        probeCodex: () => compatibleProbe('0.141.9'),
        resolveLocalCodex() {
          localResolutionCount += 1;
          return localCandidate();
        },
      },
    ),
    (error) => {
      assert.match(error.message, /explicit/i);
      assert.match(error.message, /0\.141\.9/);
      assert.match(error.message, /0\.142\.0/);
      assert.match(error.message, /upgrade|requires|supported/i);
      return true;
    },
  );

  assert.equal(localResolutionCount, 0);
});

test('a compatible Codex executable on PATH wins over the local fallback', () => {
  const probes = [];

  const executable = codex.resolveCodexExecutable(
    {},
    {
      probeCodex(candidate) {
        probes.push(candidate);
        return compatibleProbe('0.144.5');
      },
      resolveLocalCodex() {
        assert.fail('local Codex must not be resolved after a compatible PATH executable');
      },
    },
  );

  assert.equal(executable.command, 'codex');
  assert.deepEqual(executable.args, []);
  assert.deepEqual(probes, [{ command: 'codex', args: [] }]);
});

test('a missing PATH executable falls through to a compatible local Codex', () => {
  const probes = [];

  const executable = codex.resolveCodexExecutable(
    { root: '/review/root' },
    {
      probeCodex(candidate) {
        probes.push(candidate);
        return candidate.command === 'codex'
          ? missingProbe(candidate.command)
          : compatibleProbe(minimumVersion);
      },
      resolveLocalCodex(options) {
        assert.deepEqual(options, { root: '/review/root' });
        return localCandidate();
      },
    },
  );

  assert.equal(executable.command, process.execPath);
  assert.deepEqual(executable.args, ['/local/@openai/codex/bin/codex.js']);
  assert.deepEqual(probes, [
    { command: 'codex', args: [] },
    localCandidate(),
  ]);
});

test('the local fallback resolves an export-hidden Codex package from the review root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-codex-local-'));

  try {
    const packageDir = join(root, 'node_modules/@openai/codex');
    const binPath = join(packageDir, 'bin/codex.js');
    await mkdir(join(packageDir, 'bin'), { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: '@openai/codex',
      version: minimumVersion,
      exports: {
        './bin/codex.js': './bin/codex.js',
      },
      bin: {
        codex: 'bin/codex.js',
      },
    }));
    await writeFile(binPath, '#!/usr/bin/env node\n');

    assert.deepEqual(codex.resolveLocalCodexExecutable({ root }), {
      command: process.execPath,
      args: [binPath],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the local fallback searches parent node_modules from a nested review root', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'docs-codex-parent-'));

  try {
    const reviewRoot = join(projectRoot, 'docs/reference');
    const packageDir = join(projectRoot, 'node_modules/@openai/codex');
    const binPath = join(packageDir, 'bin/codex.js');
    await mkdir(reviewRoot, { recursive: true });
    await mkdir(join(packageDir, 'bin'), { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: '@openai/codex',
      version: minimumVersion,
      bin: {
        codex: 'bin/codex.js',
      },
    }));
    await writeFile(binPath, '#!/usr/bin/env node\n');

    assert.deepEqual(codex.resolveLocalCodexExecutable({ root: reviewRoot }), {
      command: process.execPath,
      args: [binPath],
    });
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test('the local fallback ignores Codex packages outside the review root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-codex-empty-'));

  try {
    assert.equal(codex.resolveLocalCodexExecutable({ root }), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the local fallback ignores Codex packages exposed only through NODE_PATH', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-codex-empty-'));
  const globalModules = await mkdtemp(join(tmpdir(), 'docs-codex-node-path-'));

  try {
    const packageDir = join(globalModules, '@openai/codex');
    await mkdir(join(packageDir, 'bin'), { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: '@openai/codex',
      version: minimumVersion,
      bin: {
        codex: 'bin/codex.js',
      },
    }));
    await writeFile(join(packageDir, 'bin/codex.js'), '#!/usr/bin/env node\n');
    const moduleUrl = new URL('../src/codex.mjs', import.meta.url).href;
    const child = spawnSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `import { resolveLocalCodexExecutable } from ${JSON.stringify(moduleUrl)};
process.stdout.write(JSON.stringify(resolveLocalCodexExecutable({ root: ${JSON.stringify(root)} })));`,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_PATH: globalModules,
      },
    });

    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, 'null');
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(globalModules, { recursive: true, force: true }),
    ]);
  }
});

test('an incompatible PATH executable falls through to a compatible local Codex', () => {
  const probes = [];

  const executable = codex.resolveCodexExecutable(
    {},
    {
      probeCodex(candidate) {
        probes.push(candidate);
        return candidate.command === 'codex'
          ? compatibleProbe('0.141.9')
          : compatibleProbe(minimumVersion);
      },
      resolveLocalCodex: localCandidate,
    },
  );

  assert.equal(executable.command, process.execPath);
  assert.deepEqual(executable.args, ['/local/@openai/codex/bin/codex.js']);
  assert.deepEqual(probes, [
    { command: 'codex', args: [] },
    localCandidate(),
  ]);
});

test('missing PATH and local Codex executables produce actionable guidance', () => {
  assert.throws(
    () => codex.resolveCodexExecutable(
      {},
      {
        probeCodex: (candidate) => missingProbe(candidate.command),
        resolveLocalCodex: () => null,
      },
    ),
    (error) => {
      assert.match(error.message, /Codex CLI/i);
      assert.match(error.message, /PATH/);
      assert.match(error.message, /@openai\/codex/);
      assert.match(error.message, /npm install --global/);
      assert.match(error.message, /codex login/i);
      assert.match(error.message, /network access/i);
      assert.match(error.message, /0\.142\.0/);
      return true;
    },
  );
});

test('incompatible PATH and local Codex executables report found and required versions', () => {
  assert.throws(
    () => codex.resolveCodexExecutable(
      {},
      {
        probeCodex(candidate) {
          return candidate.command === 'codex'
            ? compatibleProbe('0.141.9')
            : compatibleProbe('0.140.0');
        },
        resolveLocalCodex: localCandidate,
      },
    ),
    (error) => {
      assert.match(error.message, /0\.141\.9/);
      assert.match(error.message, /0\.140\.0/);
      assert.match(error.message, /0\.142\.0/);
      assert.match(error.message, /upgrade/i);
      return true;
    },
  );
});

test('Codex CLI 0.142.0 is accepted at the compatibility boundary', () => {
  const executable = codex.resolveCodexExecutable(
    {},
    {
      probeCodex: () => compatibleProbe(minimumVersion),
      resolveLocalCodex() {
        assert.fail('the boundary-compatible PATH executable must be selected');
      },
    },
  );

  assert.equal(executable.command, 'codex');
});

test('version checks require a complete safe semantic version line', () => {
  for (const output of [
    'codex-cli 0.142.0',
    'codex-cli 0.142.0+build.7',
    'codex-cli 0.142.1-rc.1',
    'warning: the old codex-cli 0.141.0 is unsupported\ncodex-cli 0.142.0',
  ]) {
    assert.doesNotThrow(() => codex.resolveCodexExecutable(
      { codexBin: '/explicit/codex' },
      { probeCodex: () => successfulProbe(output) },
    ));
  }

  for (const output of [
    'codex-cli 0.142.0-rc.1',
    'codex-cli 0.142.0.1',
    'codex-cli 9007199254740992.0.0',
  ]) {
    assert.throws(() => codex.resolveCodexExecutable(
      { codexBin: '/explicit/codex' },
      { probeCodex: () => successfulProbe(output) },
    ));
  }
});

test('a synchronous explicit probe failure has actionable remediation', () => {
  assert.throws(
    () => codex.resolveCodexExecutable(
      { codexBin: 'invalid\0codex' },
      {
        probeCodex() {
          throw new TypeError('The argument contains a null byte.');
        },
      },
    ),
    (error) => {
      assert.match(error.message, /explicit/i);
      assert.match(error.message, /null byte/i);
      assert.match(error.message, /remove.*--codex-bin/is);
      assert.match(error.message, /PATH.*local fallback/is);
      return true;
    },
  );
});

test('a local Codex wrapper is prepended to the shared safe invocation', () => {
  const invocation = codex.buildCodexInvocation({
    root: '/review/root',
    model: 'test-model',
    reasoningEffort: 'low',
    codexExecutable: localCandidate(),
    schemaFile: '/tmp/schema.json',
    outputFile: '/tmp/output.json',
  });

  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args.slice(0, 2), [
    '/local/@openai/codex/bin/codex.js',
    'exec',
  ]);
  assert.ok(invocation.args.includes('--ephemeral'));
  assert.deepEqual(optionPair(invocation.args, '--sandbox'), ['--sandbox', 'read-only']);
});

for (const reviewer of [
  {
    name: 'duplicate classifier',
    response: { matches: [] },
    run(options, dependencies) {
      return codex.runCodexClassifier([
        {
          id: 'DUP-1',
          score: 1,
          reason: 'test candidate',
          left: { file: 'a.md', line: 1, text: 'Repeated documentation rule.' },
          right: { file: 'b.md', line: 1, text: 'Repeated documentation rule.' },
        },
      ], options, dependencies);
    },
  },
  {
    name: 'style reviewer',
    response: { findings: [] },
    run(options, dependencies) {
      return codex.runCodexStyleReviewer([
        {
          id: 'README.md:1:1',
          file: 'README.md',
          line: 1,
          text: 'Use direct documentation wording.',
        },
      ], options, dependencies);
    },
  },
]) {
  test(`${reviewer.name} uses the resolved executable with read-only ephemeral arguments`, async () => {
    const probes = [];
    const spawns = [];
    const root = '/review/root';

    const result = await reviewer.run(
      {
        root,
        model: 'test-model',
        reasoningEffort: 'low',
        codexBin: '/explicit/codex',
      },
      {
        probeCodex(candidate) {
          probes.push(candidate);
          return compatibleProbe(minimumVersion);
        },
        resolveLocalCodex() {
          assert.fail('an explicit executable must not resolve a local fallback');
        },
        spawn: createCodexSpawn(reviewer.response, spawns),
      },
    );

    assert.deepEqual(result, reviewer.response);
    assert.deepEqual(probes, [{ command: '/explicit/codex', args: [] }]);
    assert.equal(spawns.length, 1);
    assert.equal(spawns[0].command, '/explicit/codex');
    assert.equal(spawns[0].args[0], 'exec');
    assert.ok(spawns[0].args.includes('--ephemeral'));
    assert.ok(spawns[0].args.includes('--ignore-rules'));
    assert.deepEqual(optionPair(spawns[0].args, '--sandbox'), ['--sandbox', 'read-only']);
    assert.deepEqual(optionPair(spawns[0].args, '--cd'), ['--cd', root]);
    assert.equal(spawns[0].args.at(-1), '-');
    assert.match(spawns[0].prompt, /documentation/i);
  });
}

test('an early Codex exit cannot surface an unhandled stdin error', async () => {
  await assert.rejects(
    () => codex.runCodexClassifier([
      {
        id: 'DUP-1',
        score: 1,
        reason: 'x'.repeat(2 * 1024 * 1024),
        left: { file: 'a.md', line: 1, text: 'Repeated documentation rule.' },
        right: { file: 'b.md', line: 1, text: 'Repeated documentation rule.' },
      },
    ], {
      root: '/review/root',
      model: 'test-model',
      reasoningEffort: 'low',
      codexBin: '/explicit/codex',
    }, {
      probeCodex: () => compatibleProbe(minimumVersion),
      spawn: createFailingCodexSpawn({
        code: 23,
        stdinError: Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
      }),
    }),
    /Codex documentation review failed.*exit code 23.*EPIPE/is,
  );
});

test('Codex signal termination is reported with its signal', async () => {
  await assert.rejects(
    () => codex.runCodexStyleReviewer([
      {
        id: 'README.md:1:1',
        file: 'README.md',
        line: 1,
        text: 'Use direct documentation wording.',
      },
    ], {
      root: '/review/root',
      model: 'test-model',
      reasoningEffort: 'low',
      codexBin: '/explicit/codex',
    }, {
      probeCodex: () => compatibleProbe(minimumVersion),
      spawn: createFailingCodexSpawn({ signal: 'SIGTERM' }),
    }),
    /Codex documentation review.*SIGTERM/is,
  );
});

test('the package does not declare Codex in any dependency set', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    assert.equal(packageJson[field]?.['@openai/codex'], undefined);
  }
});

function compatibleProbe(version) {
  return successfulProbe(`codex-cli ${version}`);
}

function successfulProbe(stdout) {
  return {
    status: 0,
    stdout: `${stdout}\n`,
    stderr: '',
  };
}

function missingProbe(command) {
  return {
    status: null,
    stdout: '',
    stderr: '',
    error: Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' }),
  };
}

function localCandidate() {
  return {
    command: process.execPath,
    args: ['/local/@openai/codex/bin/codex.js'],
  };
}

function createCodexSpawn(response, calls) {
  return (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.end = (prompt) => {
      const call = { command, args: [...args], options, prompt };
      calls.push(call);
      const outputFile = args[args.indexOf('--output-last-message') + 1];

      void writeFile(outputFile, JSON.stringify(response)).then(
        () => child.emit('close', 0, null),
        (error) => child.emit('error', error),
      );
    };

    return child;
  };
}

function createFailingCodexSpawn({ code = null, signal = null, stdinError } = {}) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new EventEmitter();
    child.stdin.end = () => {
      queueMicrotask(() => {
        if (stdinError) {
          child.stdin.emit('error', stdinError);
        }

        child.emit('close', code, signal);
      });
    };
    return child;
  };
}

function optionPair(args, option) {
  const index = args.indexOf(option);
  return args.slice(index, index + 2);
}
