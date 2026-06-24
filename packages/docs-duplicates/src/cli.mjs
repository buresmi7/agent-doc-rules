import { checkDuplicates } from './check.mjs';
import { resolveDuplicateOptions } from './config.mjs';

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  const options = await resolveDuplicateOptions(parsed);
  const result = await checkDuplicates(options);
  process.stdout.write(result.report);

  if (result.code !== 0) {
    process.exitCode = result.code;
  }
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h') {
    return { command: 'check', help: true };
  }

  if (command !== 'check') {
    throw new Error(`Unknown command: ${command}`);
  }

  const parsed = {
    command,
    include: [],
    exclude: [],
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
    } else if (arg === '--include-references') {
      parsed.includeReferences = true;
    } else if (arg === '--include-same-file') {
      parsed.includeSameFile = true;
    } else if (arg === '--warn-score') {
      parsed.warnScore = Number(readValue(rest, ++index, arg));
    } else if (arg === '--fail-score') {
      parsed.failScore = Number(readValue(rest, ++index, arg));
    } else if (arg === '--min-words') {
      parsed.minWords = Number(readValue(rest, ++index, arg));
    } else if (arg === '--min-chars') {
      parsed.minChars = Number(readValue(rest, ++index, arg));
    } else if (arg === '--max-candidates') {
      parsed.maxCandidates = Number(readValue(rest, ++index, arg));
    } else if (arg === '--model') {
      parsed.model = readValue(rest, ++index, arg);
    } else if (arg === '--reasoning-effort') {
      parsed.reasoningEffort = readValue(rest, ++index, arg);
    } else if (arg === '--codex-bin') {
      parsed.codexBin = readValue(rest, ++index, arg);
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
  return `Usage: agent-doc-rules-docs-duplicates check [options]

Options:
  --root <dir>                  Repository root. Defaults to current directory.
  --include <glob>              Include Markdown glob. Repeatable.
  --exclude <glob>              Exclude glob. Repeatable.
  --config <path>               Config file. Defaults to agent-doc-rules.config.json.
  --include-references          Include files in references/ directories.
  --include-same-file           Compare units from the same file.
  --warn-score <number>         Score threshold for warnings.
  --fail-score <number>         Score threshold for failures.
  --min-words <number>          Minimum words per prose unit.
  --min-chars <number>          Minimum characters per prose unit.
  --max-candidates <number>     Maximum candidate pairs sent to Codex.
  --model <model>               Codex model. Defaults to gpt-5-nano.
  --reasoning-effort <effort>   Codex reasoning effort. Defaults to low.
  --codex-bin <path>            Override Codex binary for local debugging.`;
}
