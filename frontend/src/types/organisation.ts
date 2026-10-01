import type { ApiResult } from "./api";
import type { MembershipRole } from "./membership";

export type IdleHandling = "off" | "flag" | "auto_subtract";

export type OrganisationProfile = {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  role: MembershipRole;
  idleHandling: IdleHandling;
  idleThresholdMinutes: number;
  windowTrackingEnabled: boolean;
  screenshotsEnabled: boolean;
  screenshotFrequencySeconds: number;
  screenshotRetentionDays: number;
  /** Admin-configurable, default 8 — informational only, never enforced. */
  workingHoursPerDay: number;
  /** The organisation's own IANA zone; 'UTC' until an admin changes it. */
  timezone: string;
  userId: string;
  /** Only the owner may start or cancel account deletion. */
  isOwner: boolean;
  /** ISO timestamps; all null for a normal active organisation. */
  deletionScheduledFor: string | null;
  suspendedAt: string | null;
  purgeAt: string | null;
};

export type OrganisationDeletionState = "active" | "scheduled" | "suspended";

export type OrganisationDeletionMode = "now" | "scheduled";

export type RequestOrganisationDeletionInput = {
  mode: OrganisationDeletionMode;
  /** ISO timestamp, required when mode is "scheduled". */
  scheduledFor?: string;
  confirmName: string;
};

export type OrganisationDeletionResult = ApiResult;

export type GetOrganisationResult =
  | { ok: true; organisation: OrganisationProfile }
  | { ok: false; message: string };

export type UpdateOrganisationInput = {
  name: string;
  address: string;
  website?: string;
  idleHandling?: IdleHandling;
  idleThresholdMinutes?: number;
  windowTrackingEnabled?: boolean;
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
};
