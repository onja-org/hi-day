/**
 * Which timer clients a member may track time from. `mobile_only` matches
 * the three-way control the spec asks for, but there is no mobile app yet:
 * it leaves a member with no usable timer at all.
 */
export type AllowedApps = 'all' | 'desktop_only' | 'mobile_only';

export const ALLOWED_APPS_VALUES: readonly AllowedApps[] = [
  'all',
  'desktop_only',
  'mobile_only',
];

export const DEFAULT_ALLOWED_APPS: AllowedApps = 'all';

/**
 * The one rule for "may this client track time", shared by the check on
 * `start` and the sweep that stops timers when the setting changes, so the
 * two can never disagree. `source` is a `TimeEntrySource`, taken as a
 * string to keep this module free of entity imports.
 */
export function isTimerSourceAllowed(
  source: string,
  allowed: AllowedApps,
): boolean {
  if (allowed === 'all') return true;
  if (allowed === 'desktop_only') return source === 'agent';
  // mobile_only: nothing to allow until a mobile client exists.
  return false;
}
