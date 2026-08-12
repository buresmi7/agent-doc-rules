import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
].join('; ');

export async function inlineViteOutput(outputDirectory) {
  const outputRoot = resolve(outputDirectory);
  const htmlPath = join(outputRoot, 'index.html');
  let html = await readFile(htmlPath, 'utf8');

  html = await replaceAsync(
    html,
    /<link\b([^>]*\brel=["']stylesheet["'][^>]*)>/gi,
    async (element, attributes) => {
      const href = readAttribute(attributes, 'href');

      if (!href) {
        throw new Error(`Cannot inline stylesheet without href: ${element}`);
      }

      const css = await readBuildAsset(outputRoot, href);
      return `<style>${escapeStyle(css)}</style>`;
    },
  );

  html = await replaceAsync(
    html,
    /<script\b([^>]*\bsrc=["'][^"']+["'][^>]*)><\/script>/gi,
    async (element, attributes) => {
      const source = readAttribute(attributes, 'src');

      if (!source) {
        throw new Error(`Cannot inline script without src: ${element}`);
      }

      const javascript = await readBuildAsset(outputRoot, source);
      const type = readAttribute(attributes, 'type');
      const typeAttribute = type ? ` type="${type}"` : '';

      return `<script${typeAttribute}>${escapeScript(javascript)}</script>`;
    },
  );

  html = injectContentSecurityPolicy(html);

  assertSelfContainedHtml(html);
  await writeFile(htmlPath, html, 'utf8');
  await rm(join(outputRoot, 'assets'), { force: true, recursive: true });

  const remainingFiles = await listFiles(outputRoot);

  if (remainingFiles.length !== 1 || remainingFiles[0] !== 'index.html') {
    throw new Error(
      `Expected a single dist/index.html artifact, found: ${remainingFiles.join(', ')}`,
    );
  }

  return htmlPath;
}

export function assertSelfContainedHtml(html) {
  const externalScript = /<script\b[^>]*\bsrc\s*=/i.test(html);
  const externalStylesheet = /<link\b[^>]*\brel=["']stylesheet["']/i.test(html);

  if (externalScript || externalStylesheet) {
    throw new Error('The viewer build still contains external scripts or stylesheets.');
  }

  if (/\b(?:src|href)=["']https?:\/\//i.test(html)) {
    throw new Error('The viewer build contains a remote runtime resource.');
  }

  if (/@import\s|url\(\s*["']?(?:https?:)?\/\//i.test(html)) {
    throw new Error('The viewer build contains a remote CSS resource.');
  }

  if (!html.includes(`http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}"`)) {
    throw new Error('The viewer build is missing its content security policy.');
  }
}

function injectContentSecurityPolicy(html) {
  if (!/<head\b[^>]*>/i.test(html)) {
    throw new Error('Cannot add the content security policy without a head element.');
  }

  const meta = `    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">\n`;

  return html.replace(/<head\b[^>]*>/i, (head) => `${head}\n${meta}`);
}

async function readBuildAsset(outputRoot, reference) {
  if (/^(?:[a-z]+:)?\/\//i.test(reference)) {
    throw new Error(`Refusing to inline a remote build asset: ${reference}`);
  }

  const cleanReference = reference
    .replace(/[?#].*$/, '')
    .replace(/^\.\//, '')
    .replace(/^\//, '');
  const assetPath = resolve(outputRoot, cleanReference);

  if (assetPath !== outputRoot && !assetPath.startsWith(`${outputRoot}/`)) {
    throw new Error(`Build asset escapes the output directory: ${reference}`);
  }

  return readFile(assetPath, 'utf8');
}

function readAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
}

function escapeScript(value) {
  return value.replace(/<\/script/gi, '<\\/script');
}

function escapeStyle(value) {
  return value.replace(/<\/style/gi, '<\\/style');
}

async function replaceAsync(value, expression, replacer) {
  const matches = [...value.matchAll(expression)];
  const replacements = await Promise.all(
    matches.map((match) => replacer(...match)),
  );
  let result = value;

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    result = `${result.slice(0, match.index)}${replacements[index]}${result.slice(
      match.index + match[0].length,
    )}`;
  }

  return result;
}

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = join(prefix, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFiles(join(directory, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  inlineViteOutput(join(packageRoot, 'dist')).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
