import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable } from 'node:stream';
import test from 'node:test';
import { runRemarkLinkEngine } from '../src/link-checker.mjs';
import { runLinks } from '../src/runner.mjs';

function discardOutput() {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
}

function captureOutput() {
  let output = '';

  return {
    read: () => output,
    stream: new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    }),
  };
}

test('link engine ignores consumer Remark config and never writes files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-config-'));
  const source = [
    '+++',
    'canonical = "https://frontmatter.invalid/ignored"',
    '+++',
    '',
    '[Missing](missing.md)',
    '',
  ].join('\n');
  await writeFile(join(root, 'README.md'), source);
  await writeFile(join(root, '.remarkignore'), 'README.md\n');
  await writeFile(
    join(root, '.remarkrc.mjs'),
    'throw new Error("consumer Remark config must not be loaded");\n',
  );

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async () => {
      throw new Error('TOML front matter must not create an outbound link');
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 1);
  assert.equal(await readFile(join(root, 'README.md'), 'utf8'), source);
});

test('external link checker follows redirects, fails dead links, and receives fragment mode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-external-'));
  const target = 'https://example.com/docs#section';
  await writeFile(join(root, 'README.md'), `${target} [Two](${target})\n`);
  await writeFile(join(root, 'OTHER.md'), `[Three](${target})\n`);
  const calls = [];
  const base = {
    root,
    files: ['README.md', 'OTHER.md'],
    skip: [],
    streamError: discardOutput(),
  };

  assert.equal(await runRemarkLinkEngine({
    ...base,
    checkFragments: true,
    checkUrl: async (url, options) => {
      calls.push({ url, options });

      if (calls.length === 1) {
        const warning = new Error('redirect dropped the fragment');
        warning.ruleId = 'lost-hash-with-redirect';
        return {
          messages: [warning],
          permanent: true,
          status: 'alive',
          url: 'https://example.com/final',
        };
      }

      return {
        messages: [],
        permanent: true,
        status: 'alive',
        url: 'https://example.com/final#section',
      };
    },
  }), 0);
  assert.deepEqual(calls, [
    {
      url: target,
      options: { checkAnchor: true, findUrls: false, followMetaHttpEquiv: false },
    },
    {
      url: 'https://example.com/final#section',
      options: { checkAnchor: true, findUrls: false, followMetaHttpEquiv: false },
    },
  ]);

  calls.length = 0;
  const redirectOutput = captureOutput();
  assert.equal(await runRemarkLinkEngine({
    ...base,
    checkFragments: true,
    streamError: redirectOutput.stream,
    checkUrl: async (url, options) => {
      calls.push({ url, options });

      if (calls.length === 1) {
        const warning = new Error('redirect dropped the fragment');
        warning.ruleId = 'lost-hash-with-redirect';
        return {
          messages: [warning],
          status: 'alive',
          url: 'https://example.com/final',
        };
      }

      return {
        messages: [new Error('missing anchor')],
        status: 'dead',
      };
    },
  }), 1);
  assert.equal(calls.length, 2);
  assert.match(redirectOutput.read(), /missing anchor/);

  calls.length = 0;
  const output = captureOutput();
  assert.equal(await runRemarkLinkEngine({
    ...base,
    checkFragments: false,
    streamError: output.stream,
    checkUrl: async (url, options) => {
      calls.push({ url, options });
      return {
        messages: [new Error('missing anchor')],
        status: 'dead',
      };
    },
  }), 1);
  assert.deepEqual(calls, [{
    url: 'https://example.com/docs',
    options: { checkAnchor: false, findUrls: false, followMetaHttpEquiv: false },
  }]);
  assert.match(output.read(), /Unexpected dead URL/);

  calls.length = 0;
  const thrownOutput = captureOutput();
  assert.equal(await runRemarkLinkEngine({
    ...base,
    checkFragments: true,
    streamError: thrownOutput.stream,
    checkUrl: async (url, options) => {
      calls.push({ url, options });
      throw new Error('request failed before a status was available');
    },
  }), 1);
  assert.equal(calls.length, 1);
  assert.match(thrownOutput.read(), /Unexpected dead URL/);
  assert.match(thrownOutput.read(), /request failed before a status was available/);
});

test('external link checker decodes percent-encoded fragments for anchor checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-external-fragment-'));
  const target = 'https://example.com/docs#caf%C3%A9';
  await writeFile(join(root, 'README.md'), `[Target](${target})\n`);
  let received;

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async (url, options) => {
      received = { url, options };
      return { messages: [], status: 'alive', url: String(url) };
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
  assert.ok(received.url instanceof URL);
  assert.equal(received.url.href, target);
  assert.equal(received.url.hash, '#café');
  assert.deepEqual(received.options, {
    checkAnchor: true,
    findUrls: false,
    followMetaHttpEquiv: false,
  });
});

test('external link checker canonicalizes valid HTTP targets before checking them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-external-canonical-'));
  await writeFile(join(root, 'README.md'), '[Target](https:example.com/missing)\n');
  const calls = [];

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async (url) => {
      calls.push(String(url));
      return { messages: [new Error('not found')], status: 'dead' };
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 1);
  assert.deepEqual(calls, ['https://example.com/missing']);
});

test('skipped external links do not reach either link checker', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-skip-'));
  await writeFile(join(root, 'README.md'), '[Skipped](https://example.com/missing)\n');
  let calls = 0;

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: ['^https://'],
    checkFragments: true,
    checkUrl: async () => {
      calls += 1;
      throw new Error('skipped URL must not be checked');
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
  assert.equal(calls, 0);
});

test('link command reports malformed external and local targets without a stack', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-malformed-'));
  await writeFile(join(root, 'README.md'), [
    '[External](https://)',
    '[Local](missing%00.md)',
    '',
  ].join('\n'));
  const output = captureOutput();

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    streamError: output.stream,
  });

  assert.equal(code, 1);
  assert.match(output.read(), /Cannot validate malformed HTTP\(S\) link `https:\/\/`/);
  assert.match(output.read(), /Cannot validate local link `missing%00\.md`: target contains a null byte/);
  assert.doesNotMatch(output.read(), /Cannot process file|TypeError|ERR_INVALID_ARG_VALUE/);
});

test('link command reports filesystem-rejected local targets without a stack', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-filesystem-error-'));
  await mkdir(join(root, 'guide.md'));
  await writeFile(join(root, 'README.md'), [
    '[Long](<' + 'a'.repeat(300) + '.md>)',
    '[Directory fragment](guide.md#missing)',
    '',
  ].join('\n'));
  const output = captureOutput();

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    streamError: output.stream,
  });

  assert.equal(code, 1);
  assert.match(output.read(), /filesystem cannot inspect target \(ENAMETOOLONG\)/);
  assert.match(output.read(), /filesystem cannot read fragment target \(EISDIR\)/);
  assert.doesNotMatch(output.read(), /Cannot process file|node:fs| at /);
});

test('link command checks cross-file Markdown and raw HTML anchors without binding', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-links-'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'README.md'), [
    '---',
    'title: Example',
    '---',
    '',
    '# Readme',
    '',
    '[Markdown](docs/guide.md#details)',
    '<a href="docs/guide.md#html-anchor">HTML</a>',
    '',
  ].join('\n'));
  await writeFile(join(root, 'docs/guide.md'), [
    '# Details',
    '',
    '<a id="html-anchor"></a>',
    '',
  ].join('\n'));
  const createServer = t.mock.method(http, 'createServer', () => {
    throw new Error('link validation must not bind a server');
  });
  const messages = [];

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, {
    logger: { log: (message) => messages.push(message) },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
  assert.equal(createServer.mock.callCount(), 0);
  assert.deepEqual(messages, ['Documentation link check passed.']);
});

test('link command checks responsive and media targets in raw HTML', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-html-media-'));
  await writeFile(join(root, 'README.md'), [
    '<picture><source srcset="small.png 1x, large.png 2x"></picture>',
    '<video poster="poster.png"></video>',
    '<object data="document.pdf"></object>',
    '',
  ].join('\n'));
  const output = captureOutput();

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, { streamError: output.stream });

  assert.equal(code, 1);
  assert.match(output.read(), /small\.png/);
  assert.match(output.read(), /large\.png/);
  assert.match(output.read(), /poster\.png/);
  assert.match(output.read(), /document\.pdf/);
});

test('link command trims HTML URL attribute whitespace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-html-whitespace-'));
  await writeFile(join(root, 'guide.md'), '# Guide\n');
  await writeFile(join(root, 'README.md'), [
    '<a href=" guide.md ">Guide</a>',
    '<a href=" https://example.com/padded ">External</a>',
    '<a href="   ">Empty</a>',
    '',
  ].join('\n'));
  const calls = [];

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async (url) => {
      calls.push(String(url));
      return { messages: [], status: 'alive', url: String(url) };
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, ['https://example.com/padded']);
});

test('link command checks meta refresh and absolute meta URL targets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-html-meta-'));
  await writeFile(join(root, 'next.md'), '# Next\n');
  await writeFile(join(root, 'README.md'), [
    '<meta http-equiv="refresh" content="0; url=&quot;next.md&quot;">',
    '<meta http-equiv="refresh" content="0; next.md">',
    '<meta name="canonical" content="https://example.com/canonical">',
    '<meta name="description" content="ordinary description text">',
    '',
  ].join('\n'));
  const calls = [];
  const options = {
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async (url) => {
      calls.push(String(url));
      return { messages: [], status: 'alive', url: String(url) };
    },
    streamError: discardOutput(),
  };

  assert.equal(await runRemarkLinkEngine(options), 0);
  assert.deepEqual(calls, ['https://example.com/canonical']);

  await writeFile(join(root, 'README.md'), [
    '<meta http-equiv="refresh" content="0; url=&quot;missing.md&quot;">',
    '<meta http-equiv="refresh" content="0; also-missing.md">',
    '<meta name="description" content="ordinary description text">',
    '',
  ].join('\n'));
  assert.equal(await runRemarkLinkEngine(options), 1);
});

test('link command ignores tag-like text inside raw-text HTML elements', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-html-raw-text-'));
  await writeFile(join(root, 'README.md'), [
    'Before <script>[Markdown](https://dead.invalid/markdown); '
      + 'const example = \'<a href="https://dead.invalid/script">\';</script> after',
    'Before <style>.example::before { '
      + 'content: \'<img src="https://dead.invalid/style">\'; }</style> after',
    'Before <textarea><a href="https://dead.invalid/textarea">example</a></textarea> after',
    'Before <title><a href="https://dead.invalid/title">example</a></title> after',
    'Before <script>[explicit][missing] [collapsed][] ![image][missing-image]</script> after',
    '',
  ].join('\n'));
  let calls = 0;

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async () => {
      calls += 1;
      throw new Error('raw-text HTML content must not create outbound links');
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
  assert.equal(calls, 0);

  await writeFile(
    join(root, 'README.md'),
    'Before <script>[inside][missing]</script> after [outside][missing]\n',
  );
  const output = captureOutput();
  assert.equal(await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async () => {
      throw new Error('reference links do not require outbound checks');
    },
    streamError: output.stream,
  }), 1);
  assert.match(output.read(), /README\.md:1:49/);
  assert.equal(output.read().match(/no-undefined-references/g)?.length, 1);
});

test('link command fails missing cross-file fragments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-fragment-'));
  await writeFile(join(root, 'README.md'), '[Guide](guide.md#missing)\n');
  await writeFile(join(root, 'guide.md'), '# Existing\n');

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, { streamError: discardOutput() });

  assert.equal(code, 1);
});

test('link command validates same-file fragments against the current Markdown file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-same-file-fragment-'));
  const options = {
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    streamError: discardOutput(),
  };

  await writeFile(join(root, 'README.md'), '# Details\n\n[Existing](#details)\n');
  assert.equal(await runRemarkLinkEngine(options), 0);

  await writeFile(join(root, 'README.md'), '# Details\n\n[Missing](#missing)\n');
  assert.equal(await runRemarkLinkEngine(options), 1);
});

test('link command preserves exact case for raw HTML anchors in Markdown', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-html-anchor-case-'));
  await writeFile(join(root, 'guide.md'), [
    '<a id="CaseAnchor" name="NameAnchor"></a>',
    '<a id="user-content-permalink-anchor" href="#Permalink"></a>',
    '',
  ].join('\n'));
  const options = {
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    streamError: discardOutput(),
  };

  await writeFile(join(root, 'README.md'), [
    '[Exact](guide.md#CaseAnchor)',
    '[Name](guide.md#NameAnchor)',
    '[Permalink](guide.md#Permalink)',
    '',
  ].join('\n'));
  assert.equal(await runRemarkLinkEngine(options), 0);

  await writeFile(join(root, 'README.md'), '[Wrong case](guide.md#caseanchor)\n');
  assert.equal(await runRemarkLinkEngine(options), 1);
});

test('link command validates exact fragments in local HTML files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-local-html-'));
  await writeFile(join(root, 'page.html'), [
    '<h1 id="CaseAnchor">Title</h1>',
    '<a id="id-anchor" name="name-anchor"></a>',
    '<a id="user-content-permalink-anchor" href="#permalink"></a>',
    '',
  ].join('\n'));
  const options = {
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    streamError: discardOutput(),
  };

  await writeFile(join(root, 'README.md'), [
    '[Exact](page.html#CaseAnchor)',
    '[ID](page.html#id-anchor)',
    '[Name](page.html#name-anchor)',
    '[Permalink](page.html#permalink)',
    '',
  ].join('\n'));
  assert.equal(await runRemarkLinkEngine(options), 0);

  await writeFile(join(root, 'README.md'), '[Wrong case](page.html#caseanchor)\n');
  assert.equal(await runRemarkLinkEngine(options), 1);
});

test('link command treats special characters in included filenames literally', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-literal-'));
  await writeFile(join(root, '[guide].md'), '[Missing](missing.md)\n');

  const code = await runLinks({
    root,
    include: ['[[]guide].md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, { streamError: discardOutput() });

  assert.equal(code, 1);
});

test('link command limits outbound checks to explicitly included files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-corpus-'));
  await writeFile(join(root, 'README.md'), '[Guide](guide.md#details)\n');
  await writeFile(join(root, 'guide.md'), '# Details\n\nhttps://outside.invalid/\n');
  let calls = 0;

  const code = await runRemarkLinkEngine({
    root,
    files: ['README.md'],
    skip: [],
    checkFragments: true,
    checkUrl: async () => {
      calls += 1;
      throw new Error('a linked target outside the corpus must not trigger outbound I/O');
    },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
  assert.equal(calls, 0);
});

test('link command rejects encoded local paths that escape the documentation root', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'docs-validator-remark-boundary-'));
  const root = join(fixture, 'docs');
  await mkdir(root);
  await writeFile(join(fixture, 'outside.md'), '# Secret\n');
  await writeFile(join(root, 'README.md'), '[Outside](%2e%2e/outside.md#secret)\n');
  const output = captureOutput();

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, { streamError: output.stream });

  assert.equal(code, 1);
  assert.match(output.read(), /target resolves outside the documentation root/);
});

test('link command rejects local targets reached through an escaping symlink', async (t) => {
  const fixture = await mkdtemp(join(tmpdir(), 'docs-validator-remark-symlink-'));
  const root = join(fixture, 'docs');
  const outside = join(fixture, 'outside');
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, 'guide.md'), '# Outside\n');

  try {
    await symlink(outside, join(root, 'linked'), 'dir');
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('directory symlinks are not available in this environment');
      return;
    }

    throw error;
  }

  await writeFile(join(root, 'README.md'), '[Outside](linked/guide.md#outside)\n');
  const output = captureOutput();

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, { streamError: output.stream });

  assert.equal(code, 1);
  assert.match(output.read(), /symbolic link outside the documentation root/);
});

test('link command decodes percent-encoded local fragments', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-encoded-fragment-'));
  await writeFile(join(root, 'README.md'), '[Guide](guide.md#details%2Done)\n');
  await writeFile(join(root, 'guide.md'), '# Details-one\n');

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, {
    logger: { log() {} },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);

  await writeFile(join(root, 'README.md'), '[Guide](guide%2Emd#missing)\n');
  assert.equal(await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, {
    logger: { log() {} },
    streamError: discardOutput(),
  }), 1);
});

test('link command ignores fragments on non-Markdown files but still checks existence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-asset-fragment-'));
  await writeFile(join(root, 'guide.pdf'), '%PDF fixture\n');
  await writeFile(join(root, 'image.png'), 'PNG fixture\n');
  await writeFile(join(root, 'README.md'), [
    '[PDF](guide.pdf#page=2)',
    '[Image region](image.png#xywh=0,0,10,10)',
    '',
  ].join('\n'));
  const options = {
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  };

  assert.equal(await runLinks(options, {
    logger: { log() {} },
    streamError: discardOutput(),
  }), 0);

  await writeFile(join(root, 'README.md'), '[Missing](missing.pdf#page=2)\n');
  assert.equal(await runLinks(options, { streamError: discardOutput() }), 1);
});

test('link command resolves root-relative links from nested Markdown files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-root-relative-'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'docs/README.md'), '[Guide](/docs/guide.md#details)\n');
  await writeFile(join(root, 'docs/guide.md'), '# Details\n');

  const code = await runLinks({
    root,
    include: ['docs/README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, {
    logger: { log() {} },
    streamError: discardOutput(),
  });

  assert.equal(code, 0);
});

test('no-fragments still checks local files and skip patterns avoid checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-no-fragments-'));
  await writeFile(join(root, 'README.md'), [
    '[Existing](guide.md#missing)',
    '[Skipped](missing.md#missing)',
    '[External](https://example.invalid/missing#fragment)',
    '',
  ].join('\n'));
  await writeFile(join(root, 'guide.md'), '# Existing\n');
  const base = {
    root,
    include: ['README.md'],
    exclude: [],
    checkFragments: false,
  };

  assert.equal(await runLinks({
    ...base,
    skip: ['missing\\.md', '^https://'],
  }, {
    logger: { log() {} },
    streamError: discardOutput(),
  }), 0);
  assert.equal(await runLinks({
    ...base,
    skip: ['^https://'],
  }, { streamError: discardOutput() }), 1);
});

test('link command reports explicit undefined references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docs-validator-remark-reference-'));
  await writeFile(join(root, 'README.md'), '[Missing][]\n');

  const code = await runLinks({
    root,
    include: ['README.md'],
    exclude: [],
    skip: [],
    checkFragments: true,
  }, { streamError: discardOutput() });

  assert.equal(code, 1);
});
