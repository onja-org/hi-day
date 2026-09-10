#!/usr/bin/env node
// Rebuilds better-sqlite3's native binding against Electron's ABI, which
// differs from the plain-Node ABI `pnpm test` needs (see rebuild:node).
// Flipping between the two is normal: run this before `electron .`, run
// rebuild:node before vitest.
//
// Two earlier attempts and why they failed, so neither gets reintroduced:
//
//   1. A shell one-liner (`cd … && VAR=val prebuild-install || node-gyp …`).
//      POSIX-only: cmd.exe cannot parse a `VAR=value command` prefix, and
//      the quoted &&/|| chain did not survive the outer shell pnpm uses to
//      invoke package.json scripts on Windows.
//   2. @electron/rebuild with `buildPath: <desktop dir>`. It scans that
//      directory's node_modules for the target module, but under pnpm
//      `desktop/node_modules/better-sqlite3` is a SYMLINK into the store,
//      which it does not resolve — so `onlyModules` matched nothing and it
//      exited successfully having rebuilt nothing at all. A silent no-op is
//      worse than the loud failure it replaced.
//
// So: resolve the module's REAL directory through Node (symlink-proof),
// then invoke the tools by their .js entrypoints via process.execPath —
// never through .bin shims, which are .cmd on Windows and need a shell.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const moduleDir = path.dirname(require.resolve('better-sqlite3/package.json'));
/**
 * Read Electron's exact installed version — the range in package.json
 * ("^33.4.11") is not precise enough for prebuild-install's --target.
 * Narrowed from `unknown` rather than trusted, so a malformed or moved
 * package.json fails loudly here instead of silently targeting `undefined`.
 * @type {unknown}
 */
const electronPackageJson = JSON.parse(
  readFileSync(require.resolve('electron/package.json'), 'utf-8'),
);
const electronVersion =
  typeof electronPackageJson === 'object' &&
  electronPackageJson !== null &&
  'version' in electronPackageJson &&
  typeof electronPackageJson.version === 'string'
    ? electronPackageJson.version
    : null;
if (!electronVersion) {
  console.error('Could not read a version string from electron/package.json.');
  process.exit(1);
}

// prebuild-install and node-gyp read their configuration from npm_config_*
// environment variables, which is the documented way to retarget a build at
// Electron's headers rather than the running Node's.
const env = {
  ...process.env,
  npm_config_runtime: 'electron',
  npm_config_target: electronVersion,
  npm_config_disturl: 'https://electronjs.org/headers',
  npm_config_arch: process.arch,
};

/**
 * @param {string} toolEntry
 * @param {string[]} args
 */
function run(toolEntry, args) {
  /** @type {string} */
  const resolved = require.resolve(toolEntry, { paths: [moduleDir] });
  return spawnSync(process.execPath, [resolved, ...args], {
    cwd: moduleDir,
    env,
    stdio: 'inherit',
  });
}

console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion} (${process.arch})`);
console.log(`  module: ${moduleDir}`);

// Prefer a prebuilt binary; fall back to compiling, exactly as better-sqlite3's
// own install script does.
// Explicit CLI flags, not just npm_config_* env: the flags are
// prebuild-install's documented interface and leave no doubt about which
// runtime/ABI is being targeted.
const prebuiltArgs = [
  '--runtime', 'electron',
  '--target', electronVersion,
  '--dist-url', 'https://electronjs.org/headers',
  '--arch', process.arch,
];
if (run('prebuild-install/bin.js', prebuiltArgs).status !== 0) {
  console.log('No prebuilt binary for this Electron ABI — compiling with node-gyp.');
  const built = run('node-gyp/bin/node-gyp.js', ['rebuild', '--release']);
  if (built.status !== 0) {
    console.error('node-gyp rebuild failed.');
    process.exit(built.status ?? 1);
  }
}

// Verify rather than assume: an earlier implementation "succeeded" while
// rebuilding nothing, and the only symptom was Electron refusing to start
// much later. Opening a database under plain Node must now FAIL — that is
// what proves the binding was built for Electron's ABI, not this Node's.
//
// It has to CONSTRUCT a Database, not merely require the package:
// better-sqlite3 loads the .node binding lazily inside the Database
// constructor, so a bare require() succeeds regardless of ABI and would
// make this check silently useless.
const check = spawnSync(
  process.execPath,
  ['-e', "const D = require('better-sqlite3'); new D(':memory:');"],
  { cwd: moduleDir, stdio: 'pipe', encoding: 'utf-8' },
);
if (check.status === 0) {
  console.error(
    'ERROR: better-sqlite3 still opens under plain Node, so it was NOT rebuilt for Electron.\n' +
      'Electron would fail at startup with a NODE_MODULE_VERSION mismatch.',
  );
  process.exit(1);
}
console.log('Rebuilt for Electron (binding no longer opens under plain Node, as expected).');
