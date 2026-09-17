export interface CaptureSettings {
  windowTrackingEnabled: boolean;
  screenshotsEnabled: boolean;
  /** How often the desktop agent captures a screenshot, in seconds. */
  screenshotFrequencySeconds: number;
  /** How long a screenshot is kept before the retention cleanup job deletes it, in days. */
  screenshotRetentionDays: number;
  /** Gates the desktop agent's keyboard/mouse input-monitoring loop (see docs/adr/0013-...) — separate from `windowTrackingEnabled`, a more sensitive capability. */
  activityTrackingEnabled: boolean;
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
  screenshotsEnabled: false,
  screenshotFrequencySeconds: DEFAULT_SCREENSHOT_FREQUENCY_SECONDS,
  screenshotRetentionDays: DEFAULT_SCREENSHOT_RETENTION_DAYS,
  activityTrackingEnabled: false,
};
