import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertSelfContainedHtml,
  inlineViteOutput,
} from '../scripts/build-single-file.mjs';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('inlineViteOutput creates one self-contained HTML artifact', async (context) => {
  const outputDirectory = await mkdtemp(join(packageRoot, '.test-build-'));
  const assetsDirectory = join(outputDirectory, 'assets');
  context.after(() => rm(outputDirectory, { force: true, recursive: true }));

  await mkdir(assetsDirectory);
  await writeFile(
    join(outputDirectory, 'index.html'),
    '<!doctype html><html><head><link rel="stylesheet" href="./assets/app.css"></head><body><div id="root"></div><script type="module" src="./assets/app.js"></script></body></html>',
  );
  await writeFile(join(assetsDirectory, 'app.css'), 'body { color: rebeccapurple; }');
  await writeFile(join(assetsDirectory, 'app.js'), 'console.log("</script>");');

  await inlineViteOutput(outputDirectory);

  const files = await readdir(outputDirectory);
  const html = await readFile(join(outputDirectory, 'index.html'), 'utf8');

  assert.deepEqual(files, ['index.html']);
  assert.match(html, /<style>body \{ color: rebeccapurple; \}<\/style>/);
  assert.match(html, /<script type="module">console\.log\("<\\\/script>"\);<\/script>/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.ok(
    html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<style>'),
    'the policy must precede inlined resources',
  );
});

test('assertSelfContainedHtml rejects remote runtime resources', () => {
  const secureShell = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-src \'none\'; worker-src \'none\'">';

  assert.throws(
    () => assertSelfContainedHtml(`${secureShell}<img src="https://example.com/pixel.png">`),
    /remote runtime resource/,
  );
  assert.throws(
    () => assertSelfContainedHtml(`${secureShell}<style>@import "//example.com/theme.css";</style>`),
    /remote CSS resource/,
  );
});
