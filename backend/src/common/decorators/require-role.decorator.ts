import { SetMetadata } from '@nestjs/common';
import { MembershipRole } from '../../database/entities/membership-role.enum';

export const REQUIRE_ROLE_KEY = 'requireRole';

/**
 * Marks a route as requiring the caller to hold one of the given
 * MembershipRoles in the Organisation identified by the route's `:id` param.
 * Enforced by RoleGuard, which re-resolves the Membership from the database
 * on every request rather than trusting anything in the JWT — the JWT is
 * identity-only (see ADR-0002), so role can never be read off it directly.
 */
export const RequireRole = (...roles: MembershipRole[]) =>
  SetMetadata(REQUIRE_ROLE_KEY, roles);
