#!/usr/bin/env node
// Rebuilds better-sqlite3's native binding against Electron's own ABI
// (distinct from the plain-Node ABI `pnpm test` needs — see rebuild:node).
//
// This used to be a shell one-liner (`cd ... && (prebuild-install ||
// node-gyp rebuild)` with npm_config_* env vars prefixed onto it) — that
// syntax is bash-only. cmd.exe can't parse a `VAR=value command` prefix at
// all, and even after routing it through cross-env-shell, the quoted
// `&&`/`||`/`()` chain still didn't survive being re-parsed by the outer
// shell pnpm itself uses to invoke package.json scripts on Windows.
// @electron/rebuild is the Electron project's own tool for exactly this —
// no shell syntax, no manual node-gyp fallback to get wrong.
import { rebuild } from '@electron/rebuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import electronPackageJson from '../node_modules/electron/package.json' with { type: 'json' };

const desktopDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

await rebuild({
  buildPath: desktopDir,
  electronVersion: electronPackageJson.version,
  onlyModules: ['better-sqlite3'],
});
