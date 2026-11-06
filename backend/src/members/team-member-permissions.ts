/**
 * Who may change a Membership's place on a Team — its `isManager` flag, or
 * its presence on the team at all.
 *
 * An org admin may do either to anyone. A team's own manager may do either
 * to that team's ordinary people, but **never to an org admin**: admin
 * access is off-limits to managers (see CONTEXT.md's MembershipRole entry),
 * and an admin who joins a team must not become removable by whoever runs
 * it. Anybody else is a reader.
 *
 * Returns the reason the action is refused, or `null` when it is allowed —
 * the reason is also what the UI puts in the tooltip on the disabled
 * control, so the button and the 403 always say the same thing.
 *
 * Imports nothing, so `scripts/generate-shared-rules.ts` can copy it into
 * the frontend verbatim and both sides answer identically.
 */
export function teamMemberActionRefusal(
  caller: { isOrgAdmin: boolean; managesThisTeam: boolean },
  target: { isOrgAdmin: boolean },
): string | null {
  if (caller.isOrgAdmin) {
    return null;
  }

  if (!caller.managesThisTeam) {
    return "Only an admin or this team's manager can change its members.";
  }

  if (target.isOrgAdmin) {
    return 'Only admins can modify another admin.';
  }

  return null;
}
