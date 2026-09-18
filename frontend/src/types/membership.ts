import type { ApiResult } from "./api";

export type MembershipRole = "admin" | "manager" | "member" | "finance";

export type MembershipStatus = "active" | "deactivated";

export type ActiveMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  teamIds: string[];
  status: MembershipStatus;
  joinedAt: string;
  /** Which disclosure/consent text this person sees — see CONTEXT.md's Disclosure region entry. `null` means the org's region-less default. */
  disclosureRegion: string | null;
};

export type GetActiveMembersResult =
  | { ok: true; members: ActiveMember[] }
  | { ok: false; message: string };

export type UpdateMembershipInput = {
  role?: MembershipRole;
  deactivate?: boolean;
  disclosureRegion?: string | null;
};

export type UpdateMembershipResult = ApiResult<{ member: ActiveMember }>;
