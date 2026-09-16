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
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { hasTeamProjectAccess } from '../team-project-access.util';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

/**
 * Authorizes read-only access to a single project (`GET :projectId`): an
 * org admin/manager can always view any project, and so can anyone who
 * simply holds a ProjectMembership on it (directly, or via a Team assigned
 * to the project — see ProjectTeam) — any role, not just project ADMIN.
 * This is deliberately looser than ProjectRoleGuard (which guards every
 * *mutating* :projectId route and only lets a project ADMIN through for
 * non-org-wide roles) — viewing a project you've been added to shouldn't
 * require the elevated project-manager delegation.
 */
@Injectable()
export class ProjectViewGuard implements CanActivate {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
    @InjectRepository(ProjectTeam)
    private readonly projectTeams: Repository<ProjectTeam>,
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

    throw new ForbiddenException('You do not have access to this project.');
  }
}
