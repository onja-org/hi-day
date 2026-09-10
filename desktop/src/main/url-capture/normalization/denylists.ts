import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Step 21's two config-file-backed rejection rules — rule 4 (known
 * placeholder strings) and rule 9 (credential/token-bearing paths).
 *
 * One module rather than two: both are "load a JSON denylist, then test a
 * string against it", both are consumed only by `normalize.ts`, and
 * neither carries enough logic to be worth its own file or its own test —
 * they are exercised together through `normalize.spec.ts`, which loads
 * these real shipped config files rather than fixtures.
 */

const DEFAULT_PLACEHOLDERS_PATH = join(__dirname, 'placeholder-strings.json');
const DEFAULT_PATTERNS_PATH = join(__dirname, 'sensitive-path-patterns.json');

export function loadPlaceholders(filePath: string = DEFAULT_PLACEHOLDERS_PATH): string[] {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as { placeholders?: unknown }).placeholders)) {
    throw new Error(`Placeholder strings file at ${filePath} is missing its "placeholders" array.`);
  }
  return (parsed as { placeholders: unknown[] }).placeholders.filter((p): p is string => typeof p === 'string');
}

/**
 * Step 21 rule 4: reject known placeholder strings (a blank/fresh tab)
 * and their localizations. Exact match, case-insensitive, against the
 * trimmed raw reading — these are fixed known-bad strings, not a pattern
 * to search for within a longer string (unlike the Firefox private-window
 * title marker, which does need substring matching against a full window
 * title).
 */
export function isPlaceholder(raw: string, placeholders: readonly string[]): boolean {
  const normalized = raw.trim().toLowerCase();
  return placeholders.some((p) => p.toLowerCase() === normalized);
}

export interface SensitivePathPatterns {
  pathPatterns: string[];
  queryKeyPatterns: string[];
}

export function loadSensitivePathPatterns(filePath: string = DEFAULT_PATTERNS_PATH): SensitivePathPatterns {
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  const obj = parsed as { pathPatterns?: unknown; queryKeyPatterns?: unknown };
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray(obj.pathPatterns) || !Array.isArray(obj.queryKeyPatterns)) {
    throw new Error(`Sensitive-path patterns file at ${filePath} is missing its "pathPatterns"/"queryKeyPatterns" arrays.`);
  }
  return {
    pathPatterns: obj.pathPatterns.filter((p): p is string => typeof p === 'string'),
    queryKeyPatterns: obj.queryKeyPatterns.filter((p): p is string => typeof p === 'string'),
  };
}

/**
 * Step 21 rule 9: reject a reading whose path or query carries a
 * credential/token-bearing pattern (password reset, email verification,
 * magic-link login). Checked against the ORIGINAL raw string (path AND
 * query together, before the query-string policy strips the query) —
 * the token itself very often lives in the query, and a reading must be
 * dropped entirely before that ever gets normalized into stored data,
 * not merely have its query stripped by the ordinary policy.
 */
export function matchesSensitivePathDenylist(pathAndQuery: string, patterns: SensitivePathPatterns): boolean {
  const normalized = pathAndQuery.toLowerCase();
  if (patterns.pathPatterns.some((p) => normalized.includes(p.toLowerCase()))) {
    return true;
  }
  return patterns.queryKeyPatterns.some((key) => new RegExp(`[?&]${key.toLowerCase()}=`).test(normalized));
}
