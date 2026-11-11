import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { ALLOW_SUSPENDED_ORGANISATION_KEY } from '../decorators/allow-suspended-organisation.decorator';
import { ALLOW_TEAM_MANAGERS_KEY } from '../decorators/allow-team-managers.decorator';
import { actsAsManager } from '../manager-scope.util';
import { resolveOrganisationAccess } from '../organisation-access.util';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const allowSuspended = this.reflector.getAllAndOverride<
      boolean | undefined
    >(ALLOW_SUSPENDED_ORGANISATION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const { membership } = await resolveOrganisationAccess(
      request,
      { organisations: this.organisations, memberships: this.memberships },
      {
        noMembershipMessage: 'You do not have access to this organisation.',
        allowSuspended,
        // actsAsManager reads the caller's teams.
        membershipRelations: { teamMemberships: true },
      },
    );

    const requiredRoles = this.reflector.getAllAndOverride<
      MembershipRole[] | undefined
    >(REQUIRE_ROLE_KEY, [context.getHandler(), context.getClass()]);

    // Only where the route opted in: managing a team is a grant over that
    // team's people, not over everything the `manager` role can reach.
    const allowsTeamManagers = this.reflector.getAllAndOverride<
      boolean | undefined
    >(ALLOW_TEAM_MANAGERS_KEY, [context.getHandler(), context.getClass()]);

    const allowed =
      requiredRoles?.includes(membership.role) ||
      (allowsTeamManagers &&
        requiredRoles?.includes(MembershipRole.MANAGER) &&
        actsAsManager(membership));

    if (requiredRoles && requiredRoles.length > 0 && !allowed) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    return true;
  }
}
