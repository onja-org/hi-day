import type { MembershipRole } from "@/types/membership";

/**
 * Whether "can see their own activity" does anything for this person.
 * Admins and anyone managing a team always see their own whatever the
 * override says (OrganisationsService.toProfile), so storing one against
 * them is a decision that never takes effect.
 */
export function activityVisibilityApplies(member: {
  role: MembershipRole;
  isManager: boolean;
}): boolean {
  return member.role !== "admin" && !member.isManager;
}
