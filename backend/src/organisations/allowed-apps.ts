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
 * Shared by the check on `start` and the sweep that stops timers when the
 * setting changes, so the two cannot disagree. `source` is a
 * `TimeEntrySource`, typed as a string to avoid an entity import here.
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
