import { MembershipRole } from '../database/entities/membership-role.enum';

export const ASSIGNABLE_MEMBERSHIP_ROLES: MembershipRole[] = [
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
];
