/**
 * Splits pasted text or a CSV file's raw content into a deduplicated list of
 * candidate emails. Deliberately naive (split on common delimiters) rather
 * than a real CSV parser — invite emails are single tokens, so there's no
 * quoting/escaping to get right, and this handles a one-per-line paste, a
 * comma-separated paste, and a single-column CSV export identically.
 */
export function parseInviteEmails(text: string): string[] {
  const candidates = text
    .split(/[\n\r,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(candidates.map((entry) => entry.toLowerCase())));
}
