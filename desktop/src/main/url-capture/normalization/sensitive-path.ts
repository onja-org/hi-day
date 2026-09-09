import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_PATTERNS_PATH = join(__dirname, 'sensitive-path-patterns.json');

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
