import { AppUrlTracking, DEFAULT_APP_URL_TRACKING } from './app-url-tracking';

export interface CaptureSettings {
  windowTrackingEnabled: boolean;
  /**
   * 3-way organisation default for whether the agent records the app the user
   * is in, and whether it also records the URL they're on inside a browser.
   * Overridable per Membership (see `Membership.appUrlTracking`).
   */
  appUrlTracking: AppUrlTracking;
  screenshotsEnabled: boolean;
  /** How often the desktop agent captures a screenshot, in seconds. */
  screenshotFrequencySeconds: number;
  /** How long a screenshot is kept before the retention cleanup job deletes it, in days. */
  screenshotRetentionDays: number;
}

/** Applied when an org hasn't customised the frequency yet — 10 minutes. */
export const DEFAULT_SCREENSHOT_FREQUENCY_SECONDS = 600;

/** Applied when an org hasn't customised retention yet — 30 days. */
export const DEFAULT_SCREENSHOT_RETENTION_DAYS = 30;

/**
 * Applied whenever an Organisation hasn't explicitly set this (including
 * every org created before this existed). `windowTrackingEnabled` defaults
 * on; the other capture settings stay off until an admin opts in (see
 * docs/adr/0009-..., docs/adr/0012-...).
 */
export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  windowTrackingEnabled: true,
  appUrlTracking: DEFAULT_APP_URL_TRACKING,
  screenshotsEnabled: false,
  screenshotFrequencySeconds: DEFAULT_SCREENSHOT_FREQUENCY_SECONDS,
  screenshotRetentionDays: DEFAULT_SCREENSHOT_RETENTION_DAYS,
};
