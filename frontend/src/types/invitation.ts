import type { ApiResult } from "./api";
import type { MembershipRole } from "./membership";

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type PendingInvitation = {
  id: string;
  email: string;
  role: MembershipRole;
  teamId: string | null;
  projectIds: string[];
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string | null;
};

export type GetPendingInvitationsResult =
  | { ok: true; invitations: PendingInvitation[] }
  | { ok: false; message: string };

export type InviteEntryInput = {
  email: string;
  role: MembershipRole;
  teamId?: string;
  projectIds?: string[];
};

export type InviteOutcome = "sent" | "resent" | "already_member" | "invalid";

export type InviteEntryResult = {
  email: string;
  outcome: InviteOutcome;
  message?: string;
};

export type InviteMembersResult = ApiResult<{ results: InviteEntryResult[] }>;

export type InvitationActionResult = ApiResult;

export type InvitationPreview = {
  status: InvitationStatus | "not_found";
  email?: string;
  organisationName?: string;
  role?: MembershipRole;
  teamName?: string | null;
  accountAlreadyExists?: boolean;
};

export type GetInvitationPreviewResult =
  | { ok: true; preview: InvitationPreview }
  | { ok: false; message: string };

export type AcceptInvitationInput = {
  password?: string;
  firstName?: string;
  lastName?: string;
};

export type AcceptInvitationResult = ApiResult<
  object,
  { accountExists?: boolean }
>;

