import type { ApiResult } from "./api";
import type { MembershipRole } from "./membership";

export type IdleHandling = "off" | "flag" | "auto_subtract";

/** Mirrors the backend's `INDUSTRY_VALUES`. */
export type Industry =
  | "software_it"
  | "consulting"
  | "marketing_advertising"
  | "design"
  | "finance"
  | "healthcare"
  | "education"
  | "construction"
  | "legal"
  | "retail"
  | "manufacturing"
  | "non_profit"
  | "government"
  | "media"
  | "other";

export type WeekStart = "sunday" | "monday";

/** The organisation's 3-way "Track apps & URLs" default. */
export type AppUrlTracking = "off" | "apps" | "apps_urls";

/** Which timer clients a member may track time from. */
export type AllowedApps = "all" | "desktop_only" | "mobile_only";

/**
 * Who may add manual time and edit previously-tracked time. Declared and
 * configurable, but not yet consulted when a Time entry is created or
 * edited — see CONTEXT.md's Timesheets settings entry.
 */
export type TimesheetModifyTime = "off" | "add_edit";

/** What the organisation expects of a week, and the ceilings on tracking.
 * Expected hours are a target for reports; only the limits cap. */
export type WorkTimeLimits = {
  /** 0 = Sunday, matching `Date.getDay()`. */
  expectedWorkDays: number[];
  trackingDisabledDays: number[];
  /** `null` means removed (target) or no limit (ceilings). */
  expectedWeeklyHours: number | null;
  weeklyLimitHours: number | null;
  dailyLimitHours: number | null;
};

export type OrganisationProfile = {
  id: number;
  name: string;
  address: string | null;
  industry: Industry | null;
  taxId: string | null;
  website: string | null;
  role: MembershipRole;
  idleHandling: IdleHandling;
  idleThresholdMinutes: number;
  windowTrackingEnabled: boolean;
  appUrlTracking: AppUrlTracking;
  allowedApps: AllowedApps;
  workTimeLimits: WorkTimeLimits;
  timesheetModifyTime: TimesheetModifyTime;
  /** Whether *you* may add manual time and edit tracked time: always for an
   * admin, otherwise per Modify time. Your role decides whose time. */
  canModifyTime: boolean;
  timesheetRequireApproval: boolean;
  timesheetManagersApproveOwn: boolean;
  /** Whether the Reason field is compulsory when time is added, edited or deleted. */
  timesheetRequireReason: boolean;
  screenshotsEnabled: boolean;
  screenshotFrequencySeconds: number;
  screenshotRetentionDays: number;
  /** Admin-configurable, default 8 — informational only, never enforced. */
  workingHoursPerDay: number;
  /** The organisation's own IANA zone; 'UTC' until an admin changes it. */
  timezone: string;
  /** 'monday' until an admin changes it. */
  weekStartsOn: WeekStart;
  userId: string;
  /** Only the owner may start or cancel account deletion. */
  isOwner: boolean;
  /** ISO timestamps; all null for a normal active organisation. */
  deletionScheduledFor: string | null;
  suspendedAt: string | null;
  purgeAt: string | null;
};

/** `purging` begins at `purgeAt`: from then on nothing can stop the purge. */
export type OrganisationDeletionState =
  | "active"
  | "scheduled"
  | "suspended"
  | "purging";

/** `permanent` skips the recovery window entirely — see ADR-0023. */
export type OrganisationDeletionMode = "now" | "scheduled" | "permanent";

export type RequestOrganisationDeletionInput = {
  mode: OrganisationDeletionMode;
  /** ISO timestamp, required when mode is "scheduled". */
  scheduledFor?: string;
  confirmName: string;
};

export type OrganisationDeletionResult = ApiResult;

/** `signedOut` is true when the purge is about to erase the caller's own account. */
export type OrganisationDeletionConfirmResult = ApiResult<{ signedOut: boolean }>;

export type GetOrganisationResult =
  | { ok: true; organisation: OrganisationProfile }
  | { ok: false; message: string };

/** Every field optional: the API merges what it is given, so a settings
 * section sends only its own. */
export type UpdateOrganisationInput = {
  name?: string;
  /** '' clears it, here and for `industry`, `taxId` and `website`. */
  address?: string;
  industry?: Industry | "";
  taxId?: string;
  website?: string;
  weekStartsOn?: WeekStart;
  timezone?: string;
  idleHandling?: IdleHandling;
  idleThresholdMinutes?: number;
  windowTrackingEnabled?: boolean;
  appUrlTracking?: AppUrlTracking;
  allowedApps?: AllowedApps;
  expectedWorkDays?: number[];
  trackingDisabledDays?: number[];
  expectedWeeklyHours?: number | null;
  weeklyLimitHours?: number | null;
  dailyLimitHours?: number | null;
  timesheetModifyTime?: TimesheetModifyTime;
  timesheetRequireApproval?: boolean;
  timesheetManagersApproveOwn?: boolean;
  timesheetRequireReason?: boolean;
  screenshotsEnabled?: boolean;
  screenshotFrequencySeconds?: number;
  screenshotRetentionDays?: number;
  workingHoursPerDay?: number;
};

export type UpdateOrganisationResult = ApiResult<{
  organisation: OrganisationProfile;
}>;

export type OrganisationDeletionStatus = {
  state: OrganisationDeletionState;
  graceDays: number;
  isOwner: boolean;
  /** What deleting would remove. */
  impact: {
    people: number;
    projects: number;
    trackedSeconds: number;
    devices: number;
  };
  /** Where the confirmation link is sent; null unless the caller is the owner. */
  ownerEmail: string | null;
  /** Whether the owner's account survives the purge; null unless the caller is the owner. */
  ownerKeepsAccount: boolean | null;
  /** The request awaiting its emailed confirmation; null unless the caller is the owner. */
  pendingRequestMode: OrganisationDeletionMode | null;
};
