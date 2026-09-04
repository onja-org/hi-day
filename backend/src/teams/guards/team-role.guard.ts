import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';

/**
 * Authorizes team-scoped routes (:teamId in the URL, e.g. viewing a
 * team's roster or managing its members): an org admin can always manage
 * any team, and — layered on top — a caller who manages that specific
 * team (a `team_memberships` row with `isManager: true`) can manage it
 * too, even if their org role is plain "member" or "manager" without any
 * other team. Mirrors ProjectRoleGuard's delegation pattern.
 *
 * Creating, renaming, and deleting a team stay behind the plain RoleGuard
 * + @RequireRole(ADMIN) — only this guard's routes (team detail, member
 * add/remove) are open to a team's own manager(s).
 */
@Injectable()
export class TeamRoleGuard implements CanActivate {
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
    const publicId = Number(request.params.id);

    if (!Number.isInteger(publicId)) {
      throw new NotFoundException('Organisation not found.');
    }

    const organisation = await this.organisations.findOne({
      where: { publicId },
    });

    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }

    request.organisationId = organisation.id;

    const membership = await this.memberships.findOne({
      where: {
        userId: request.userId,
        organisationId: organisation.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organisation.',
      );
    }

    if (membership.role === MembershipRole.ADMIN) {
      return true;
    }

    const teamId = request.params.teamId as string | undefined;
    const teamMembership = teamId
      ? await this.teamMemberships.findOne({
          where: { teamId, membershipId: membership.id },
        })
      : null;

    if (teamMembership?.isManager) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have the required role for this team.',
    );
  }
}
