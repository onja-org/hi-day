import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_PLACEHOLDERS_PATH = join(__dirname, 'placeholder-strings.json');

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
