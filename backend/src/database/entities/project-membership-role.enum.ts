/**
 * A per-project role, independent of the org-wide MembershipRole. A
 * ProjectMembership with role MANAGER can manage that specific project
 * (edit, archive/unarchive, add/remove members, change other members'
 * roles) even if the person's org role is plain "member" — see
 * ProjectRoleGuard. A VIEWER can see the project (and, once project
 * reports exist, its team reports) but can't log time against it or be
 * assigned its tasks — see isTimeTrackingRole. There is no project-level
 * "admin", mirroring the Team model (team_memberships.isManager).
 */
export enum ProjectMembershipRole {
  MANAGER = 'manager',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

/** Whether a direct ProjectMembership with this role lets its holder log
 * time against the project and be assigned its tasks — every role except
 * VIEWER. A viewer who also reaches the project through a Team assigned to
 * it still gets that Team's member-equivalent access (see ProjectTeam). */
export function isTimeTrackingRole(role: ProjectMembershipRole): boolean {
  return role !== ProjectMembershipRole.VIEWER;
}
