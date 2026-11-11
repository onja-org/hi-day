import { AllowedApps, DEFAULT_ALLOWED_APPS } from './allowed-apps';
import { AppUrlTracking, DEFAULT_APP_URL_TRACKING } from './app-url-tracking';

export interface CaptureSettings {
  windowTrackingEnabled: boolean;
  /** "Record activity" — overridable per Membership. */
  activityTrackingEnabled: boolean;
  /**
   * 3-way organisation default for whether the agent records the app the user
   * is in, and whether it also records the URL they're on inside a browser.
   * Overridable per Membership (see `Membership.appUrlTracking`).
   */
  appUrlTracking: AppUrlTracking;
  /** Which timer clients this member may track from. */
  allowedApps: AllowedApps;
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
 * Applied whenever an Organisation hasn't explicitly set this.
 * `windowTrackingEnabled` defaults on; the rest stay off until an admin
 * opts in (see docs/adr/0009-..., docs/adr/0012-...). Organisations that
 * predate `activityTrackingEnabled` are not covered by its `false`: a
 * migration wrote an explicit `true` into each, since activity had been
 * recorded for them all along.
 */
export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  windowTrackingEnabled: true,
  activityTrackingEnabled: false,
  appUrlTracking: DEFAULT_APP_URL_TRACKING,
  allowedApps: DEFAULT_ALLOWED_APPS,
  screenshotsEnabled: false,
  screenshotFrequencySeconds: DEFAULT_SCREENSHOT_FREQUENCY_SECONDS,
  screenshotRetentionDays: DEFAULT_SCREENSHOT_RETENTION_DAYS,
};

/** The one place this is decided, so the agent's settings poll and the
 * timesheet's label can never disagree. A plain function rather than a
 * second service dependency — the modules already import one way round. */
export function resolveActivityTrackingEnabled(
  organisationDefault: boolean | undefined,
  membershipOverride: boolean | null | undefined,
): boolean {
  return (
    membershipOverride ??
    organisationDefault ??
    DEFAULT_CAPTURE_SETTINGS.activityTrackingEnabled
  );
}

/**
 * Whether a member may see their *own* tracked activity — the Activity page
 * (apps, URLs, screenshots) and the activity widgets on their own
 * dashboard. Defaults on: every organisation that predates this setting
 * keeps showing members their own data until an admin turns it off. When
 * off, those surfaces are hidden entirely, so a member cannot tell the data
 * is being collected (see the member-visibility toggle in the settings UI).
 *
 * This gates only the viewer seeing *their own* data; it never affects what
 * an admin or team manager may see about the people they oversee.
 */
export const DEFAULT_MEMBERS_CAN_VIEW_OWN_ACTIVITY = true;

export function resolveCanViewOwnActivity(
  organisationDefault: boolean | undefined,
  membershipOverride: boolean | null | undefined,
): boolean {
  return (
    membershipOverride ??
    organisationDefault ??
    DEFAULT_MEMBERS_CAN_VIEW_OWN_ACTIVITY
  );
}
