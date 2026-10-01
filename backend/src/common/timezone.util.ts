/**
 * Whether a string is an IANA timezone this runtime recognises — "the zone
 * the browser reported" is client-supplied, so it is checked rather than
 * trusted before being stored and later handed back for formatting.
 *
 * Asking Intl is most of the check: it throws on an unknown zone, and it is
 * the same database the frontend formats with, so anything accepted here is
 * usable there.
 *
 * Intl alone is too lax, though — it also accepts legacy abbreviations
 * (`EAT`) and POSIX forms (`est5edt`), which carry no region or city and so
 * cannot be shown as "EAT: Indian - Antananarivo". Only `Area/Location`
 * zones pass, plus `UTC`, which is the Organisation default.
 */
export function isValidTimezone(value: string): boolean {
  if (value !== 'UTC' && !value.includes('/')) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
