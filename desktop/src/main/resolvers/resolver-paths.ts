import { join } from 'node:path';

/**
 * Where the resolver side-car lives.
 *
 * The linux resolver is compiled TypeScript inside the app's own
 * `dist/main/`, so `__dirname` is correct in dev and packaged alike, with no
 * dev-vs-packaged branch. The macOS and Windows resolvers live on
 * sandy/feat/url-tracking-on-remaining-os; the Windows one is a separately
 * built native .exe and does need that branch, which is why this file exists
 * rather than the path being inlined at its single call site.
 */

/** This file compiles to `dist/main/resolvers/`, so `__dirname` is the resolvers directory. */
const RESOLVERS_DIR = __dirname;

export function resolveLinuxResolverPath(): string {
  return join(RESOLVERS_DIR, 'linux', 'index.js');
}
