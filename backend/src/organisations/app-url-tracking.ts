/**
 * How much of what the user is looking at the desktop agent records while a
 * timer is running — set once at the Organisation (the default) and
 * optionally overridden per Membership. See the "Track apps & URLs" setting
 * in the Settings area.
 */
export type AppUrlTracking = 'off' | 'apps' | 'apps_urls';

export const APP_URL_TRACKING_VALUES: readonly AppUrlTracking[] = [
  'off',
  'apps',
  'apps_urls',
];

/** Applied when an Organisation hasn't customised this yet. */
export const DEFAULT_APP_URL_TRACKING: AppUrlTracking = 'apps';
