import type { ApiResult } from "./api";

export type InviteLinkRole = "member" | "manager";

export type InviteLinkStatus = "active" | "disabled" | "expired" | "full";

export type InviteLink = {
  id: string;
  name: string;
  role: InviteLinkRole;
  teamIds: string[];
  projectIds: string[];
  expiresAt: string | null;
  /** Max accepted joins; null means unlimited. */
  usageCap: number | null;
  usageCount: number;
  enabled: boolean;
  status: InviteLinkStatus;
  token: string;
  createdAt: string;
};

export type InviteLinkInput = {
  name: string;
  role: InviteLinkRole;
  teamIds: string[];
  projectIds: string[];
  expiresAt: string | null;
  usageCap: number | null;
  enabled: boolean;
  /** Sent on creation only, when the admin ticked the consent: joins
   * through the link are then charged on the spot (ADR 0033). */
  seatChargeConsent?: boolean;
};

export type InviteLinkPreview = {
  status: InviteLinkStatus | "not_found";
  organisationName?: string;
  role?: InviteLinkRole;
};

export type GetInviteLinksResult =
  | { ok: true; inviteLinks: InviteLink[] }
  | { ok: false; message: string };

export type SaveInviteLinkResult = ApiResult<{ inviteLink: InviteLink }>;

export type InviteLinkActionResult = ApiResult;

export type GetInviteLinkPreviewResult =
  | { ok: true; preview: InviteLinkPreview }
  | { ok: false; message: string };
