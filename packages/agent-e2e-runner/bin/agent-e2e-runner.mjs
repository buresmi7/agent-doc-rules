#!/usr/bin/env node
import { main } from '../src/cli.mjs';

process.exitCode = await main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  return 1;
});
