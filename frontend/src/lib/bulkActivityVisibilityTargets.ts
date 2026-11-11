import { activityVisibilityApplies } from "./activityVisibilityApplies";
import type { TeamMember } from "@/types/team";

/**
 * Who a bulk change lands on, as far as this page can tell: plain members,
 * never the viewer. The server applies the same rule and also drops anyone
 * managing another team, which isn't knowable here — so this is the count
 * to warn with, not the count to report.
 */
export function bulkActivityVisibilityTargets(
  members: TeamMember[],
  callerUserId: string | undefined,
): TeamMember[] {
  return members.filter(
    (member) =>
      activityVisibilityApplies(member) && member.userId !== callerUserId,
  );
}
