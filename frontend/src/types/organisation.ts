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
  userId: string;
};

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
