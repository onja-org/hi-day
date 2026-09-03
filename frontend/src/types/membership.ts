export type MembershipRole = "admin" | "manager" | "member" | "finance";

export type MembershipStatus = "active" | "deactivated";

export type ActiveMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  teamId: string | null;
  status: MembershipStatus;
  joinedAt: string;
};

export type GetActiveMembersResult =
  | { ok: true; members: ActiveMember[] }
  | { ok: false; message: string };

export type UpdateMembershipInput = {
  role?: MembershipRole;
  deactivate?: boolean;
};

export type UpdateMembershipResult =
  | { ok: true; member: ActiveMember }
  | { ok: false; message: string };
