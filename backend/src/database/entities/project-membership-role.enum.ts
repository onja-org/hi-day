/**
 * A per-project role, independent of the org-wide MembershipRole. A
 * ProjectMembership with role MANAGER can manage that specific project
 * (edit, archive/unarchive, add/remove members, change other members'
 * roles) even if the person's org role is plain "member" — see
 * ProjectRoleGuard. There is no project-level "admin" — only manager and
 * member, mirroring the Team model (team_memberships.isManager).
 */
export enum ProjectMembershipRole {
  MANAGER = 'manager',
  MEMBER = 'member',
}
