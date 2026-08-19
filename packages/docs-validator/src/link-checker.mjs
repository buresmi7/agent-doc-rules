import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { deadOrAlive } from 'dead-or-alive';
import GithubSlugger from 'github-slugger';
import { Parser as HtmlParser } from 'htmlparser2';
import { toString } from 'mdast-util-to-string';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkLintNoUndefinedReferences from 'remark-lint-no-undefined-references';
import remarkParse from 'remark-parse';
import { parseSrcset } from 'srcset';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { VFile } from 'vfile';

const externalLinkDataId = Symbol('agent-doc-rules-external-links');
const markdownExtensions = new Set(['.markdown', '.mdown', '.md', '.mkdn']);
const htmlExtensions = new Set(['.htm', '.html']);
const localFileSystemErrorCodes = new Set([
  'EACCES',
  'EISDIR',
  'EINVAL',
  'ELOOP',
  'ENAMETOOLONG',
  'EPERM',
]);
const rawTextElements = new Set(['script', 'style', 'textarea', 'title']);
const htmlLinkAttributes = new Map([
  ['a', ['href']],
  ['area', ['href']],
  ['audio', ['src']],
  ['blockquote', ['cite']],
  ['body', ['background']],
  ['command', ['icon']],
  ['del', ['cite']],
  ['embed', ['href', 'pluginspage', 'pluginurl', 'src']],
  ['frame', ['longdesc', 'src']],
  ['html', ['manifest']],
  ['iframe', ['longdesc', 'src']],
  ['img', ['src', 'srcset']],
  ['input', ['src']],
  ['ins', ['cite']],
  ['link', ['href']],
  ['object', ['data']],
  ['q', ['cite']],
  ['script', ['src']],
  ['source', ['src', 'srcset']],
  ['track', ['src']],
  ['video', ['poster', 'src']],
]);

export async function runRemarkLinkEngine({
  root,
  files,
  skip = [],
  checkFragments = true,
  checkUrl = deadOrAlive,
  streamError = process.stderr,
}) {
  const absoluteRoot = resolve(root);
  const anchorCache = new Map();
  const processedFiles = [];
  await validateInputFiles(absoluteRoot, files);
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm)
    .use(remarkPrepareLinks, {
      anchorCache,
      checkFragments,
      root: absoluteRoot,
      skip,
    })
    .use(remarkLintNoUndefinedReferences, { allowShortcutLink: true });

  for (const filePath of files) {
    const file = new VFile({
      cwd: absoluteRoot,
      path: filePath,
      value: await readFile(resolve(absoluteRoot, filePath), 'utf8'),
    });
    const tree = await processor.run(processor.parse(file), file);
    file.data[externalLinkDataId] = collectExternalLinkNodes(tree);
    processedFiles.push(file);
  }

  await checkExternalLinksForFiles(processedFiles, {
    checkFragments,
    checkUrl,
    concurrency: 10,
  });
  reportLinkMessages(processedFiles, streamError);
  return processedFiles.some((file) => file.messages.length > 0) ? 1 : 0;
}

function reportLinkMessages(files, stream) {
  for (const file of files) {
    for (const message of file.messages) {
      const line = message.line ?? 1;
      const column = message.column ?? 1;
      const origin = [message.source, message.ruleId].filter(Boolean).join(':');
      stream.write(
        `${file.path}:${line}:${column} ${message.reason}${origin ? ` (${origin})` : ''}\n`,
      );
    }
  }
}

async function validateInputFiles(root, files) {
  const realRoot = await realpath(resolve(root));

  for (const file of files) {
    const realFile = await realpath(resolve(root, file));

    if (!isWithinRoot(realFile, realRoot)) {
      throw new Error(
        `Included Markdown file ${JSON.stringify(file)} resolves outside documentation root `
        + `${JSON.stringify(root)}. Remove the path or replace the escaping symbolic link.`,
      );
    }
  }
}

function remarkPrepareLinks({
  anchorCache = new Map(),
  root,
  skip = [],
  checkFragments = true,
} = {}) {
  const skipPatterns = skip.map((pattern) => new RegExp(pattern));
  const realRootPromise = realpath(resolve(root));

  return async (tree, file) => {
    const html = extractHtmlLinkNodes(tree);
    const syntheticNodes = html.nodes;
    const linkNodes = [];

    if (syntheticNodes.length > 0) {
      tree.children.push({
        type: 'paragraph',
        children: syntheticNodes,
      });
    }

    visit(tree, (node) => {
      if (html.ignoredLinkNodes.has(node)) {
        if ('url' in node) {
          node.url = '';
        } else if (node.type === 'text') {
          delete node.position;
        } else {
          node.type = 'text';
          node.value = toString(node);
          delete node.position;
        }
        return;
      }

      if (!('url' in node) || typeof node.url !== 'string' || node.url.length === 0) {
        return;
      }

      linkNodes.push(node);
    });

    const realRoot = await realRootPromise;

    for (const node of linkNodes) {
      const original = node.url;
      let target = checkFragments ? original : stripFragment(original);

      if (target.startsWith('//')) {
        target = `https:${target}`;
      }

      if (skipPatterns.some((pattern) => pattern.test(original) || pattern.test(target))) {
        node.url = '';
        continue;
      }

      if (/^https?:/i.test(target)) {
        try {
          target = new URL(target).href;
        } catch {
          reportInvalidExternalLink(file, node, original);
          node.url = '';
          continue;
        }

        if (skipPatterns.some((pattern) => pattern.test(target))) {
          node.url = '';
          continue;
        }
      }

      if (isLocalLink(target)) {
        const localPath = resolveLocalLinkPath(target, { file, root });

        if (localPath.error) {
          reportInvalidLocalLink(file, node, original, localPath.error);
          node.url = '';
          continue;
        }

        if (!isWithinRoot(localPath.path, root)) {
          reportInvalidLocalLink(
            file,
            node,
            original,
            'target resolves outside the documentation root',
          );
          node.url = '';
          continue;
        }

        const inspected = await captureLocalFileSystemError(
          () => realpathNearestExisting(localPath.path),
          'inspect target',
        );

        if (inspected.error) {
          reportInvalidLocalLink(file, node, original, inspected.error);
          node.url = '';
          continue;
        }

        if (!isWithinRoot(inspected.value, realRoot)) {
          reportInvalidLocalLink(
            file,
            node,
            original,
            'target resolves through a symbolic link outside the documentation root',
          );
          node.url = '';
          continue;
        }

        const exists = await captureLocalFileSystemError(
          () => pathExists(localPath.path),
          'inspect target',
        );

        if (exists.error) {
          reportInvalidLocalLink(file, node, original, exists.error);
          node.url = '';
          continue;
        }

        if (!exists.value) {
          reportMissingLocalLink(file, node, original);
          node.url = '';
          continue;
        }

        if (checkFragments) {
          const decoded = decodeLocalFragment(target);

          if (decoded.error) {
            reportInvalidLocalLink(file, node, original, decoded.error);
            node.url = '';
            continue;
          }

          target = decoded.value;

          if (node.type !== 'image' && target.includes('#')) {
            const kind = localFragmentKind(localPath.path);

            if (kind) {
              const validated = await captureLocalFileSystemError(
                () => validateLocalFragment({
                  anchorCache,
                  currentTree: tree,
                  file,
                  kind,
                  node,
                  target,
                  targetPath: localPath.path,
                }),
                'read fragment target',
              );

              if (validated.error) {
                reportInvalidLocalLink(file, node, original, validated.error);
                node.url = '';
                continue;
              }
            }
          }

          target = stripFragment(target);
        }
      }

      if (target.startsWith('/')) {
        target = resolveRootRelativeLink(target, { file, root });
      }

      node.url = target;
    }
  };
}

async function captureLocalFileSystemError(operation, action) {
  try {
    return { value: await operation() };
  } catch (error) {
    if (!localFileSystemErrorCodes.has(error?.code)) {
      throw error;
    }

    return { error: 'filesystem cannot ' + action + ' (' + error.code + ')' };
  }
}

async function realpathNearestExisting(target) {
  let candidate = target;

  while (true) {
    try {
      return await realpath(candidate);
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }

      const parent = dirname(candidate);

      if (parent === candidate) {
        throw error;
      }

      candidate = parent;
    }
  }
}

function isMissingPathError(error) {
  return error?.code === 'ENOENT' || error?.code === 'ENOTDIR';
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw error;
  }
}

function isLocalLink(target) {
  return !target.startsWith('//') && !/^[a-z][a-z\d+.-]*:/i.test(target);
}

function localFragmentKind(targetPath) {
  const extension = extname(targetPath).toLowerCase();
  return markdownExtensions.has(extension)
    ? 'markdown'
    : htmlExtensions.has(extension)
    ? 'html'
    : undefined;
}

async function validateLocalFragment({
  anchorCache,
  currentTree,
  file,
  kind,
  node,
  target,
  targetPath,
}) {
  const fragmentIndex = target.indexOf('#');
  const fragment = fragmentIndex === -1 ? '' : target.slice(fragmentIndex + 1);

  if (!fragment) {
    return;
  }

  const sourcePath = file.path ? resolve(file.cwd, file.path) : resolve(file.cwd, 'stdin.md');
  let anchors;

  if (kind === 'markdown' && targetPath === sourcePath) {
    anchors = collectMarkdownAnchors(currentTree);
  } else {
    const cacheKey = `${kind}:${targetPath}`;
    let pending = anchorCache.get(cacheKey);

    if (!pending) {
      pending = loadLocalAnchors(targetPath, kind);
      anchorCache.set(cacheKey, pending);
    }

    anchors = await pending;
  }

  if (!anchors || anchors.has(fragment)) {
    return;
  }

  const displayPath = relative(dirname(sourcePath), targetPath).split(sep).join('/') || '.';
  const message = file.message(
    `Cannot find fragment \`#${fragment}\` in \`${displayPath}\``,
    {
      ancestors: [node],
      place: node.position,
      ruleId: 'missing-local-fragment',
      source: 'agent-doc-rules',
    },
  );
  message.fatal = false;
}

async function loadLocalAnchors(targetPath, kind) {
  let content;

  try {
    content = await readFile(targetPath, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }

    throw error;
  }

  if (kind === 'html') {
    return collectHtmlAnchors(content);
  }

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm);
  const tree = processor.parse(content);
  const html = extractHtmlLinkNodes(tree);

  return collectMarkdownAnchors(tree, html.nodes);
}

function collectMarkdownAnchors(tree, extraNodes = []) {
  const anchors = new Set();
  const slugger = new GithubSlugger();

  visit(tree, (node) => {
    if (node.type === 'heading') {
      anchors.add(slugger.slug(toString(node, {
        includeHtml: false,
        includeImageAlt: false,
      })));
    }

    const properties = node.data?.hProperties;
    const id = properties?.id ?? properties?.name;

    if (id) {
      anchors.add(String(id));
    }
  });

  for (const node of extraNodes) {
    const properties = node.data?.hProperties;
    const id = properties?.id ?? properties?.name;

    if (id) {
      anchors.add(String(id));
    }
  }

  return anchors;
}

function collectHtmlAnchors(content) {
  const anchors = new Set();
  const parser = new HtmlParser({
    onopentag(tagName, attributes) {
      for (const anchor of htmlAnchorValues(tagName, attributes)) {
        anchors.add(anchor);
      }
    },
  }, { decodeEntities: true });
  parser.end(content);
  return anchors;
}

function resolveLocalLinkPath(target, { file, root }) {
  const suffixIndex = firstIndex(target, ['?', '#']);
  const pathname = suffixIndex === -1 ? target : target.slice(0, suffixIndex);
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return { error: 'target contains invalid percent-encoding' };
  }

  if (decodedPath.includes('\0')) {
    return { error: 'target contains a null byte' };
  }

  const sourcePath = file.path ? resolve(file.cwd, file.path) : resolve(file.cwd, 'stdin.md');

  return {
    path: decodedPath === ''
      ? sourcePath
      : decodedPath.startsWith('/')
      ? resolve(root, `.${decodedPath}`)
      : resolve(dirname(sourcePath), decodedPath),
  };
}

function isWithinRoot(target, root) {
  const fromRoot = relative(resolve(root), target);
  return fromRoot === ''
    || (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`));
}

function decodeLocalFragment(target) {
  const index = target.indexOf('#');

  if (index === -1) {
    return { value: target };
  }

  try {
    return {
      value: `${target.slice(0, index + 1)}${decodeURIComponent(target.slice(index + 1))}`,
    };
  } catch {
    return { error: 'fragment contains invalid percent-encoding' };
  }
}

function reportInvalidLocalLink(file, node, target, reason) {
  const message = file.message(`Cannot validate local link \`${target}\`: ${reason}`, {
    ancestors: [node],
    place: node.position,
    ruleId: 'invalid-local-target',
    source: 'agent-doc-rules',
  });
  message.fatal = false;
}

function reportMissingLocalLink(file, node, target) {
  const message = file.message(`Cannot find local link target \`${target}\``, {
    ancestors: [node],
    place: node.position,
    ruleId: 'missing-local-target',
    source: 'agent-doc-rules',
  });
  message.fatal = false;
}

function reportInvalidExternalLink(file, node, target) {
  const message = file.message(`Cannot validate malformed HTTP(S) link \`${target}\``, {
    ancestors: [node],
    place: node.position,
    ruleId: 'invalid-external-target',
    source: 'agent-doc-rules',
  });
  message.fatal = false;
}

async function checkExternalLinksForFiles(files, {
  checkFragments,
  checkUrl,
  concurrency,
}) {
  const referencesByUrl = new Map();
  const limit = createAsyncLimit(concurrency);

  for (const file of files) {
    const nodesByUrl = file.data[externalLinkDataId];

    if (!nodesByUrl) {
      continue;
    }

    for (const [url, nodes] of nodesByUrl) {
      const references = referencesByUrl.get(url) ?? [];
      references.push({ file, nodes });
      referencesByUrl.set(url, references);
    }
  }

  await Promise.all([...referencesByUrl].map(([url, references]) => limit(async () => {
    let checked;

    try {
      const options = {
        checkAnchor: checkFragments,
        findUrls: false,
        followMetaHttpEquiv: false,
      };
      checked = await checkUrl(externalCheckTarget(url, checkFragments), options);

      if (lostFragmentOnRedirect(url, checked)) {
        const redirectedTarget = restoreRedirectFragment(url, checked.url);
        checked = await checkUrl(externalCheckTarget(redirectedTarget, true), options);
      }
    } catch (error) {
      checked = {
        messages: [error instanceof Error ? error : new Error(String(error))],
        status: 'dead',
      };
    }

    const causes = checked.status === 'dead'
      ? checked.messages.length > 0
        ? checked.messages
        : [new Error('URL check returned a dead status')]
      : [];

    for (const { file, nodes } of references) {
      for (const node of nodes) {
        for (const cause of causes) {
          const detail = String(cause?.message ?? cause).replace(/\s+/g, ' ').trim();
          const message = file.message(
            `Unexpected dead URL \`${url}\`, expected live URL${detail ? `: ${detail}` : ''}`,
            {
              ancestors: [node],
              cause,
              place: node.position,
              ruleId: 'no-dead-url',
              source: 'agent-doc-rules',
            },
          );
          message.fatal = false;
        }
      }
    }
  })));
}

function lostFragmentOnRedirect(originalUrl, checked) {
  return checked.status === 'alive'
    && Boolean(checked.url)
    && new URL(originalUrl).hash.length > 0
    && new URL(checked.url).hash.length === 0
    && checked.messages.some((message) => message.ruleId === 'lost-hash-with-redirect');
}

function restoreRedirectFragment(originalUrl, redirectedUrl) {
  const original = new URL(originalUrl);
  const redirected = new URL(redirectedUrl);
  redirected.hash = original.hash;
  return redirected.href;
}

function externalCheckTarget(href, checkFragments) {
  if (!checkFragments) {
    return href;
  }

  const url = new URL(href);

  if (!url.hash.includes('%')) {
    return href;
  }

  try {
    const decodedHash = `#${decodeURIComponent(url.hash.slice(1))}`;
    // dead-or-alive reads `hash` directly but does not decode it before matching HTML IDs.
    Object.defineProperty(url, 'hash', {
      configurable: true,
      get() {
        return decodedHash;
      },
    });
    return url;
  } catch {
    return href;
  }
}

function extractHtmlLinkNodes(tree) {
  const nodes = [];
  const ignoredLinkNodes = new Set();
  let currentHtmlNode;
  let rawTextDepth = 0;
  const parser = new HtmlParser({
    onopentag(tagName, attributes) {
      if (!(tagName === 'link' && ['dns-prefetch', 'preconnect'].includes(attributes.rel))) {
        for (const url of htmlLinkTargets(tagName, attributes)) {
          nodes.push(isHtmlAsset(tagName, attributes)
            ? {
                type: 'image',
                url,
                alt: attributes.alt ?? null,
                title: null,
                position: currentHtmlNode?.position,
              }
            : {
                type: 'link',
                url,
                children: [],
                title: null,
                position: currentHtmlNode?.position,
              });
        }
      }

      for (const id of htmlAnchorValues(tagName, attributes)) {
        nodes.push({
          type: 'text',
          value: '',
          data: { hProperties: { id } },
          position: currentHtmlNode?.position,
        });
      }

      if (rawTextElements.has(tagName)) {
        rawTextDepth += 1;
      }
    },
    onclosetag(tagName) {
      if (rawTextElements.has(tagName) && rawTextDepth > 0) {
        rawTextDepth -= 1;
      }
    },
  }, {
    decodeEntities: true,
    recognizeSelfClosing: true,
  });

  visit(tree, (node) => {
    if (node.type === 'html') {
      currentHtmlNode = node;
      parser.write(node.value);
    } else if (rawTextDepth > 0 && (
      node.type === 'text'
      || ('url' in node && typeof node.url === 'string' && node.url.length > 0)
      || node.type === 'linkReference'
      || node.type === 'imageReference'
    )) {
      ignoredLinkNodes.add(node);
    }
  });
  parser.end();

  return { ignoredLinkNodes, nodes };
}

function htmlAnchorValues(tagName, attributes) {
  const anchors = [];

  if (attributes.id) {
    anchors.push(attributes.id);
  }

  if (tagName === 'a' && attributes.name) {
    anchors.push(attributes.name);
  }

  if (
    tagName === 'a'
    && attributes.id
    && attributes.href?.startsWith('#')
    && attributes.href.length > 1
  ) {
    anchors.push(attributes.href.slice(1));
  }

  return anchors;
}

function htmlLinkTargets(tagName, attributes) {
  if (tagName === 'meta' && attributes.content) {
    const refresh = attributes['http-equiv']?.toLowerCase() === 'refresh'
      ? metaRefreshTarget(attributes.content)
      : undefined;

    if (refresh) {
      return [refresh];
    }

    try {
      return [new URL(trimHtmlUrl(attributes.content)).href];
    } catch {
      return [];
    }
  }

  const targets = [];

  for (const attribute of htmlLinkAttributes.get(tagName) ?? []) {
    const value = trimHtmlUrl(attributes[attribute] ?? '');

    if (!value) {
      continue;
    }

    if (attribute === 'srcset') {
      try {
        targets.push(
          ...parseSrcset(value)
            .map((candidate) => trimHtmlUrl(candidate.url))
            .filter(Boolean),
        );
      } catch {
        // Invalid srcset syntax does not contain a reliably checkable target.
      }
    } else {
      targets.push(value);
    }
  }

  return targets;
}

function metaRefreshTarget(content) {
  const match = content.match(
    /^[\t\n\f\r ]*(?:\d+(?:\.\d*)?|\.\d+)[\t\n\f\r ]*[,;][\t\n\f\r ]*(?:url[\t\n\f\r ]*=[\t\n\f\r ]*)?(?:"([^"]*)"|'([^']*)'|(.+?))[\t\n\f\r ]*$/i,
  );
  return match ? trimHtmlUrl(match[1] ?? match[2] ?? match[3]) : undefined;
}

function trimHtmlUrl(value) {
  return value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '');
}

function isHtmlAsset(tagName, attributes) {
  return tagName === 'img'
    || tagName === 'source'
    || (tagName === 'video' && Boolean(attributes.poster));
}

function resolveRootRelativeLink(target, { file, root }) {
  const suffixIndex = firstIndex(target, ['?', '#']);
  const pathname = suffixIndex === -1 ? target : target.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : target.slice(suffixIndex);
  const normalizedPath = new URL(pathname, 'https://agent-doc-rules.invalid').pathname;
  const absoluteTarget = resolve(root, `.${normalizedPath}`);
  const sourcePath = file.path ? resolve(file.cwd, file.path) : resolve(file.cwd, 'stdin.md');
  let relativeTarget = relative(dirname(sourcePath), absoluteTarget).split(sep).join('/');

  if (!relativeTarget) {
    relativeTarget = '.';
  } else if (!relativeTarget.startsWith('.')) {
    relativeTarget = `./${relativeTarget}`;
  }

  return `${relativeTarget}${suffix}`;
}

function firstIndex(value, characters) {
  let result = -1;

  for (const character of characters) {
    const index = value.indexOf(character);

    if (index !== -1 && (result === -1 || index < result)) {
      result = index;
    }
  }

  return result;
}

function stripFragment(value) {
  const index = value.indexOf('#');
  return index === -1 ? value : value.slice(0, index);
}

function collectExternalLinkNodes(tree) {
  const nodesByUrl = new Map();

  visit(tree, (node) => {
    if ('url' in node && typeof node.url === 'string' && /^https?:\/\//i.test(node.url)) {
      const nodes = nodesByUrl.get(node.url) ?? [];
      nodes.push(node);
      nodesByUrl.set(node.url, nodes);
    }
  });

  return nodesByUrl;
}

function createAsyncLimit(concurrency) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('External link concurrency must be a positive integer.');
  }

  const waiting = [];
  let active = 0;

  function startNext() {
    if (active >= concurrency || waiting.length === 0) {
      return;
    }

    const { task, resolveTask, rejectTask } = waiting.shift();
    active += 1;

    Promise.resolve()
      .then(task)
      .then(resolveTask, rejectTask)
      .finally(() => {
        active -= 1;
        startNext();
      });
  }

  return (task) => new Promise((resolveTask, rejectTask) => {
    waiting.push({ task, resolveTask, rejectTask });
    startNext();
  });
}
