import type { MembershipRole } from "./membership";

export type OrganisationProfile = {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  role: MembershipRole;
};

export type GetOrganisationResult =
  | { ok: true; organisation: OrganisationProfile }
  | { ok: false; message: string };

export type UpdateOrganisationInput = {
  name: string;
  address: string;
  website?: string;
};

export type UpdateOrganisationResult =
  | { ok: true; organisation: OrganisationProfile }
  | { ok: false; message: string };
