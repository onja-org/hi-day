/**
 * A per-project role, independent of the org-wide MembershipRole. A
 * ProjectMembership with role ADMIN can manage that specific project
 * (edit, archive/unarchive, add/remove members) even if the person's org
 * role is plain "member" — see ProjectRoleGuard.
 */
export enum ProjectMembershipRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}
