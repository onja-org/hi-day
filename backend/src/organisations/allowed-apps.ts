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
