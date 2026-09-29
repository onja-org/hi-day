import type { MembershipRole } from "@/types/membership";

const LABELS: Record<MembershipRole, string> = {
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  finance: "Finance",
};

export function formatMembershipRole(role: MembershipRole): string {
  return LABELS[role];
}
