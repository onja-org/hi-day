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
import { resolveProjectsEnabled } from '../../organisations/projects-setting';

/**
 * Turns every Project and Task route off for someone who doesn't track time
 * against Projects: their own Membership override, else the Organisation's
 * default. An admin or manager also gets through while the organisation
 * default is on or anyone has been switched on individually, because they
 * run the Projects those people pick from. Works for both callers: a device
 * route has the Organisation pinned by its session (`request.organisationId`,
 * set first by DeviceSessionGuard), a web route names it by public id in
 * `:id`.
 */
@Injectable()
export class ProjectsEnabledGuard implements CanActivate {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    let where: { id: string } | { publicId: number };
    if (request.organisationId) {
      where = { id: request.organisationId };
    } else {
      const publicId = Number(request.params.id);
      if (!Number.isInteger(publicId)) {
        throw new NotFoundException('Organisation not found.');
      }
      where = { publicId };
    }

    const organisation = await this.organisations.findOne({ where });
    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }

    const organisationDefault = (
      organisation.settings as { projectsEnabled?: boolean }
    ).projectsEnabled;
    const membership = await this.memberships.findOne({
      where: {
        userId: request.userId,
        organisationId: organisation.id,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (
      resolveProjectsEnabled(organisationDefault, membership?.projectsEnabled)
    ) {
      return true;
    }

    const managesProjects =
      membership?.role === MembershipRole.ADMIN ||
      membership?.role === MembershipRole.MANAGER;
    if (managesProjects) {
      if (organisationDefault) return true;
      const switchedOn = await this.memberships.count({
        where: {
          organisationId: organisation.id,
          status: MembershipStatus.ACTIVE,
          projectsEnabled: true,
        },
      });
      if (switchedOn > 0) return true;
    }

    throw new ForbiddenException(
      'Projects are not enabled for this organisation.',
    );
  }
}
