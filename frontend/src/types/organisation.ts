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
};

export type UpdateOrganisationResult =
  | { ok: true; organisation: OrganisationProfile }
  | { ok: false; message: string };
