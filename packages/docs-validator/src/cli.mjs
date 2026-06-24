import { resolveDocsOptions } from './config.mjs';
import { runCheck, runLinks, runMarkdown } from './runner.mjs';

const commands = new Set(['markdown', 'links', 'check']);

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  const options = parsed.command === 'check'
    ? {
        markdownOptions: await resolveDocsOptions({ ...parsed, command: 'markdown' }),
        linksOptions: await resolveDocsOptions({ ...parsed, command: 'links' }),
      }
    : await resolveDocsOptions(parsed);
  const code = await runCommand(parsed.command, options);

  if (code !== 0) {
    process.exitCode = code;
  }
}

export async function runCommand(command, options, deps = {}) {
  if (command === 'markdown') {
    return runMarkdown(options, deps);
  }

  if (command === 'links') {
    return runLinks(options, deps);
  }

  if (command === 'check') {
    return runCheck(options, deps);
  }

  throw new Error(`Unknown command: ${command}`);
}

export function parseArgs(argv) {
  const [maybeCommand, ...rest] = argv;

  if (!maybeCommand || maybeCommand === '--help' || maybeCommand === '-h') {
    return { command: 'check', help: true };
  }

  if (!commands.has(maybeCommand)) {
    throw new Error(`Unknown command: ${maybeCommand}`);
  }

  const parsed = {
    command: maybeCommand,
    include: [],
    exclude: [],
    skip: [],
    checkFragments: undefined,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === '--root') {
      parsed.root = readValue(rest, ++index, arg);
    } else if (arg === '--include') {
      parsed.include.push(readValue(rest, ++index, arg));
    } else if (arg === '--exclude') {
      parsed.exclude.push(readValue(rest, ++index, arg));
    } else if (arg === '--config') {
      parsed.configPath = readValue(rest, ++index, arg);
    } else if (arg === '--skip') {
      parsed.skip.push(readValue(rest, ++index, arg));
    } else if (arg === '--no-fragments') {
      parsed.checkFragments = false;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readValue(args, index, option) {
  const value = args[index];

  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function usage() {
  return `Usage: agent-doc-rules-docs <command> [options]

Commands:
  markdown      Run Markdown linting.
  links         Run Markdown link validation.
  check         Run Markdown linting, then link validation.

Options:
  --root <dir>          Repository root. Defaults to the current directory.
  --include <glob>      Include Markdown glob. Repeatable.
  --exclude <glob>      Exclude glob. Repeatable.
  --config <path>       Config file. Defaults to agent-doc-rules.config.json.
  --skip <regex>        Linkinator skip pattern. Repeatable.
  --no-fragments        Do not ask Linkinator to check fragments.`;
}
