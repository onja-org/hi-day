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
import { Organisation } from '../../database/entities/organisation.entity';
import { DEFAULT_PROJECTS_ENABLED } from '../../organisations/projects-setting';

/**
 * Turns every Project and Task route off for an Organisation that hasn't
 * enabled Projects. Works for both callers: a device route has the
 * Organisation pinned by its session (`request.organisationId`, set first by
 * DeviceSessionGuard), a web route names it by public id in `:id`.
 */
@Injectable()
export class ProjectsEnabledGuard implements CanActivate {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
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

    const enabled =
      (organisation.settings as { projectsEnabled?: boolean })
        .projectsEnabled ?? DEFAULT_PROJECTS_ENABLED;
    if (!enabled) {
      throw new ForbiddenException(
        'Projects are not enabled for this organisation.',
      );
    }
    return true;
  }
}
