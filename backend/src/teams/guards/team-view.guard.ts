import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { resolveOrganisationAccess } from '../../common/organisation-access.util';
import { TeamMembership } from '../../database/entities/team-membership.entity';

/**
 * Authorizes read-only access to a single team (`GET :teamId`): an org
 * admin can always view any team, and so can anyone who simply holds a
 * team_memberships row on it — manager or plain member. Mirrors
 * ProjectViewGuard's split from its mutating counterpart (TeamRoleGuard,
 * which only lets a team's own manager(s) through for non-admins).
 */
@Injectable()
export class TeamViewGuard implements CanActivate {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(TeamMembership)
    private readonly teamMemberships: Repository<TeamMembership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { membership } = await resolveOrganisationAccess(
      request,
      { organisations: this.organisations, memberships: this.memberships },
      { noMembershipMessage: 'You do not have access to this organisation.' },
    );

    if (membership.role === MembershipRole.ADMIN) {
      return true;
    }

    const teamId = request.params.teamId as string | undefined;
    const teamMembership = teamId
      ? await this.teamMemberships.findOne({
          where: { teamId, membershipId: membership.id },
        })
      : null;

    if (teamMembership) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this team.');
  }
}
