/**
 * Which timer clients a member may track time from — the Organisation
 * default, overridable per Membership.
 *
 * `mobile_only` exists to match the three-way control the product spec
 * asks for, but there is no mobile app yet: choosing it leaves a member
 * with no usable timer at all, which the settings copy says plainly.
 */
export type AllowedApps = 'all' | 'desktop_only' | 'mobile_only';

export const ALLOWED_APPS_VALUES: readonly AllowedApps[] = [
  'all',
  'desktop_only',
  'mobile_only',
];

/** Nothing is restricted until an admin restricts it. */
export const DEFAULT_ALLOWED_APPS: AllowedApps = 'all';
