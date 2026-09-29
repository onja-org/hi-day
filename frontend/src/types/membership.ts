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

/** A Members-page row — see the backend's ActiveMemberListItem. */
export type ActiveMemberListItem = ActiveMember & {
  /** Direct project memberships only, not access via a team. */
  projectIds: string[];
};

export type PasswordResetResult = {
  membershipId: string;
  email: string | null;
  outcome: "sent" | "skipped";
  message?: string;
};

export type SendPasswordResetsResult = ApiResult<{ results: PasswordResetResult[] }>;

export type GetActiveMembersResult =
  | { ok: true; members: ActiveMemberListItem[] }
  | { ok: false; message: string };

export type UpdateMembershipInput = {
  role?: MembershipRole;
  deactivate?: boolean;
  disclosureRegion?: string | null;
  firstName?: string;
  lastName?: string;
};

export type UpdateMembershipResult = ApiResult<{ member: ActiveMember }>;
