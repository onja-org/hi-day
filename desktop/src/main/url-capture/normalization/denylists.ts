import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The two config-file-backed rejection rules: placeholder strings and
 * credential-bearing paths. One module because both are "load a JSON
 * denylist, test a string against it", and both are tested through
 * normalize.spec.ts against the real shipped files.
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
 * Rejects a blank/fresh tab. Exact case-insensitive match, not substring:
 * these are whole known-bad readings.
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
  // `#` is a delimiter too: implicit-flow credentials arrive in the
  // fragment, which is now kept rather than discarded.
  return patterns.queryKeyPatterns.some((key) =>
    new RegExp(`[?&#]${key.toLowerCase()}=`).test(normalized),
  );
}
