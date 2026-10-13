import type { MembershipRole } from "@/types/membership";
import type { ProjectMember } from "@/types/project";

/**
 * Who the "Log time for" picker offers on a project, matching the backend:
 * a project manager may log for anyone on their project, an admin for
 * anyone, and any other org manager only for people they can see (their
 * teams — `visibleMembershipIds`, `null` while that list loads). Viewers
 * can't have time logged, and the caller is "Me" already.
 */
export function logTimeForCandidates(
  projectMembers: ProjectMember[],
  caller: { userId: string; role: MembershipRole },
  visibleMembershipIds: ReadonlySet<string> | null,
): ProjectMember[] {
  const others = projectMembers.filter(
    (member) => member.role !== "viewer" && member.userId !== caller.userId,
  );
  const managesProject = projectMembers.some(
    (member) => member.userId === caller.userId && member.role === "manager",
  );
  if (managesProject || caller.role === "admin") return others;
  return others.filter(
    (member) => visibleMembershipIds?.has(member.membershipId) ?? false,
  );
}
