/**
 * A member's own Activity → Screenshots page. The viewer's own gallery is
 * the page with no `membershipId` — that is what the member filter calls
 * "You", and passing their own id would leave it showing nobody selected.
 */
export function buildMemberScreenshotsHref(
  organisationId: string,
  membershipId: string,
  ownMembershipId: string | undefined,
): string {
  const path = `/organisations/${organisationId}/activities/screenshots`;
  if (membershipId === ownMembershipId) return path;
  return `${path}?${new URLSearchParams({ membershipId }).toString()}`;
}
