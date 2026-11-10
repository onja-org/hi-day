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
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

/**
 * Authorizes mutating project-scoped routes (:projectId in the URL): an
 * org admin/manager can always manage any project, and — layered on top —
 * a ProjectMembership with role MANAGER on that specific project can
 * manage that project too (add/remove members, change other members'
 * roles, edit, archive/unarchive, delete), even if the caller's org role is plain
 * "member". This is what makes project-level manager useful as a
 * delegation mechanism, rather than just a label. A plain project MEMBER
 * never passes this guard — see ProjectViewGuard for their read-only
 * access instead.
 *
 * `create` (no :projectId — an org-wide operation) stays behind the plain
 * RoleGuard + @RequireRole(ADMIN, MANAGER) instead of this guard. `list`
 * uses RoleGuard + @RequireRole(ADMIN, MANAGER, MEMBER), scoped per-caller
 * inside ProjectsService.list.
 */
@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { membership } = await resolveOrganisationAccess(
      request,
      { organisations: this.organisations, memberships: this.memberships },
      {
        noMembershipMessage:
          'You do not have the required role for this organisation.',
      },
    );

    if (ORG_WIDE_ROLES.includes(membership.role)) {
      return true;
    }

    const projectId = request.params.projectId as string | undefined;
    const projectMembership = projectId
      ? await this.projectMemberships.findOne({
          where: { projectId, membershipId: membership.id },
        })
      : null;

    if (projectMembership?.role === ProjectMembershipRole.MANAGER) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have the required role for this project.',
    );
  }
}
