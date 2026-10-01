/**
 * Whether a string is an IANA timezone this runtime recognises. The zone
 * arrives from a browser, so it is checked before being stored.
 *
 * Intl does most of the work — it throws on an unknown zone, from the same
 * database the frontend formats with — but is too lax alone: it also takes
 * legacy abbreviations (`EAT`) and POSIX forms (`est5edt`), which carry no
 * region to label. Only `Area/Location` passes, plus the `UTC` default.
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
