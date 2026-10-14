import type { MembershipRole } from "@/types/membership";

type CanDeleteShownScreenshotsInput = {
  role: MembershipRole | undefined;
  /** The resolved org/override answer for the viewer's *own* screenshots. */
  canDeleteOwnScreenshots: boolean;
  /** undefined = the viewer's own gallery; an id = someone else's. */
  viewedMembershipId: string | undefined;
};

/**
 * Whether the gallery on screen should offer its delete controls. An
 * admin may delete anyone's, so they show everywhere; everyone else may
 * only delete their own, so they show only on their own gallery — a
 * manager viewing a team member would otherwise be offered a button the
 * API always refuses.
 */
export function canDeleteShownScreenshots({
  role,
  canDeleteOwnScreenshots,
  viewedMembershipId,
}: CanDeleteShownScreenshotsInput): boolean {
  if (role === "admin") return true;
  return viewedMembershipId === undefined && canDeleteOwnScreenshots;
}
