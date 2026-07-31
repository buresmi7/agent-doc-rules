#!/usr/bin/env node

import { runSessionViewerCli } from '../src/cli.mjs';

try {
  await runSessionViewerCli();
} catch (error) {
  console.error(`agent-session-viewer: ${error.message}`);
  process.exitCode = 1;
}
