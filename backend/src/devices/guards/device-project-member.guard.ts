import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { DeviceAuthenticatedRequest } from '../device-session.guard';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { hasTeamProjectAccess } from '../../projects/team-project-access.util';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

/**
 * The device-auth counterpart to ProjectMemberGuard: same "org
 * admin/manager or any ProjectMembership on this project" rule (directly,
 * or via a Team assigned to it — see ProjectTeam), but reads the caller's
 * identity from the device session (DeviceSessionGuard, which must run
 * first) instead of a JWT + route's public organisation id — a device
 * route has no `:id` organisation param, since the device session already
 * pins one organisation.
 */
@Injectable()
export class DeviceProjectMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
    @InjectRepository(ProjectTeam)
    private readonly projectTeams: Repository<ProjectTeam>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<DeviceAuthenticatedRequest>();

    const membership = await this.memberships.findOne({
      where: {
        userId: request.userId,
        organisationId: request.organisationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    if (ORG_WIDE_ROLES.includes(membership.role)) {
      return true;
    }

    const projectId = request.params.projectId as string | undefined;
    const projectMembership = projectId
      ? await this.projectMemberships.findOne({
          where: { projectId, membershipId: membership.id },
        })
      : null;

    if (projectMembership) {
      return true;
    }

    if (
      projectId &&
      (await hasTeamProjectAccess(this.projectTeams, projectId, membership.id))
    ) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have the required role for this project.',
    );
  }
}
