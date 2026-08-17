import { resolveDocsOptions, resolveDuplicateCandidateOptions } from './config.mjs';
import { runDuplicateCandidates } from './duplicate-candidates-command.mjs';
import { runInit } from './init.mjs';
import { runCheck, runLinks, runMarkdown, runSecurity, runWording } from './runner.mjs';

const commands = new Set([
  'init',
  'markdown',
  'wording',
  'security',
  'links',
  'duplicate-candidates',
  'check',
]);

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  const options = parsed.command === 'init'
    ? parsed
    : parsed.command === 'duplicate-candidates'
    ? await resolveDuplicateCandidateOptions(parsed)
    : parsed.command === 'check'
    ? {
        markdownOptions: await resolveDocsOptions({ ...parsed, command: 'markdown' }),
        wordingOptions: await resolveDocsOptions({ ...parsed, command: 'wording' }),
        securityOptions: await resolveDocsOptions({ ...parsed, command: 'security' }),
        linksOptions: await resolveDocsOptions({ ...parsed, command: 'links' }),
      }
    : await resolveDocsOptions(parsed);
  const code = await runCommand(parsed.command, options);

  if (code !== 0) {
    process.exitCode = code;
  }
}

export async function runCommand(command, options, deps = {}) {
  if (command === 'init') {
    return runInit(options, deps);
  }

  if (command === 'markdown') {
    return runMarkdown(options, deps);
  }

  if (command === 'wording') {
    return runWording(options, deps);
  }

  if (command === 'links') {
    return runLinks(options, deps);
  }

  if (command === 'security') {
    return runSecurity(options, deps);
  }

  if (command === 'duplicate-candidates') {
    const runCandidates = deps.runDuplicateCandidates ?? runDuplicateCandidates;
    return runCandidates(options, deps);
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
    focus: [],
    skip: [],
    forbiddenTerms: [],
    allow: [],
    checkFragments: undefined,
    force: false,
    print: false,
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
    } else if (arg === '--focus') {
      parsed.focus.push(readValue(rest, ++index, arg));
    } else if (arg === '--format') {
      parsed.format = readValue(rest, ++index, arg);
    } else if (arg === '--include-references') {
      parsed.includeReferences = true;
    } else if (arg === '--include-same-file') {
      parsed.includeSameFile = true;
    } else if (arg === '--min-similarity') {
      parsed.minSimilarity = readNumber(rest, ++index, arg);
    } else if (arg === '--min-words') {
      parsed.minWords = readNumber(rest, ++index, arg);
    } else if (arg === '--min-chars') {
      parsed.minChars = readNumber(rest, ++index, arg);
    } else if (arg === '--max-candidates') {
      parsed.maxCandidates = readNumber(rest, ++index, arg);
    } else if (arg === '--cursor') {
      parsed.cursor = readValue(rest, ++index, arg);
    } else if (arg === '--warn-score') {
      throw new Error('--warn-score was renamed to --min-similarity.');
    } else if (arg === '--fail-score') {
      throw new Error('--fail-score was removed because candidates have no severity.');
    } else if (arg === '--min-score') {
      throw new Error('--min-score was renamed to --min-similarity.');
    } else if (arg === '--skip') {
      parsed.skip.push(readValue(rest, ++index, arg));
    } else if (arg === '--forbid') {
      parsed.forbiddenTerms.push(readValue(rest, ++index, arg));
    } else if (arg === '--allow') {
      parsed.allow.push(readValue(rest, ++index, arg));
    } else if (arg === '--no-fragments') {
      parsed.checkFragments = false;
    } else if (arg === '--force') {
      parsed.force = true;
    } else if (arg === '--print') {
      parsed.print = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function readNumber(args, index, option) {
  const raw = readValue(args, index, option);
  const value = Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`${option} must be a number.`);
  }

  return value;
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
  init          Write a starter agent-doc-rules.config.json.
  markdown      Run Markdown linting.
  wording       Run deterministic prose wording checks.
  security      Run deterministic documentation security checks.
  links         Run Markdown link validation.
  duplicate-candidates
                Find likely duplicate prose for review by the current agent.
  check         Run Markdown linting, wording, security, then link validation.

Options:
  --root <dir>          Repository root. Defaults to the current directory.
  --include <glob>      Include Markdown glob. Repeatable.
  --exclude <glob>      Exclude glob. Repeatable.
  --focus <glob>        Compare matching files with the full corpus. Repeatable.
  --config <path>       Config file. Defaults to agent-doc-rules.config.json.
  --format <format>     Candidate output: text or json. Defaults to text.
  --include-references  Include references/ directories in duplicate candidates.
  --include-same-file   Include candidate pairs from the same file.
  --min-similarity <n>  Minimum deterministic similarity from 0 through 1.
  --min-words <number>  Minimum words in a prose unit.
  --min-chars <number>  Minimum characters in a prose unit.
  --max-candidates <n>  Maximum candidates in one page.
  --cursor <id>         Continue after a previous page's nextCursor.
  --skip <regex>        Linkinator skip pattern. Repeatable.
  --forbid <term>       Project-specific term that should fail. Repeatable.
  --allow <regex>       Wording or security allow pattern for matching lines. Repeatable.
  --no-fragments        Do not ask Linkinator to check fragments.
  --print               Print the starter config without writing files.
  --force               Overwrite an existing config during init.`;
}
