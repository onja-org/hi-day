#!/usr/bin/env node
// Stand-in for `mdfind`, which doesn't exist off macOS. Pretends exactly
// two bundle ids are "installed" (found at some fake path); everything
// else returns nothing, matching real mdfind's behavior for a query that
// matches zero files (empty stdout, exit 0).
const query = process.argv[2] ?? '';
const INSTALLED = ['com.google.Chrome', 'com.apple.Safari'];

const match = INSTALLED.find((bundleId) => query.includes(bundleId));
if (match) {
  process.stdout.write(`/Applications/Fake ${match}.app\n`);
}
process.exit(0);
