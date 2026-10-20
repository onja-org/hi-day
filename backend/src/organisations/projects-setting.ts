/**
 * Whether time is tracked against Projects. Off unless an admin turns it on:
 * an Organisation that never set it reads as off, and the migration that
 * introduced it switches it on for every Organisation that already has
 * Projects, so nobody's existing setup changes underneath them.
 */
export const DEFAULT_PROJECTS_ENABLED = false;

/**
 * Whether one person tracks time against Projects: their own Membership
 * override when an admin set one, else the Organisation's default. The
 * override works both ways — it can switch Projects on for one person while
 * the default is off, or off for one while it is on.
 */
export function resolveProjectsEnabled(
  organisationDefault: boolean | undefined,
  membershipOverride: boolean | null | undefined,
): boolean {
  return membershipOverride ?? organisationDefault ?? DEFAULT_PROJECTS_ENABLED;
}
