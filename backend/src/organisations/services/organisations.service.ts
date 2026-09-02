import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationRegion } from '../../database/entities/organisation-region.enum';
import { Team } from '../../database/entities/team.entity';
import { UpdateOrganisationDto } from '../dto/update-organisation.dto';
import { generateSlug } from '../slug.util';

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_CURRENCY = 'USD';
const DEFAULT_TEAM_NAME = 'General';

export interface CreateOrganisationInput {
  name: string;
  address?: string | null;
  website?: string | null;
}

export interface OrganisationProfile {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  role: MembershipRole;
}

@Injectable()
export class OrganisationsService {
  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createForUser(
    manager: EntityManager,
    userId: string,
    input: CreateOrganisationInput,
  ): Promise<Organisation> {
    const organisation = await manager.save(
      manager.create(Organisation, {
        name: input.name,
        slug: generateSlug(input.name),
        region: OrganisationRegion.US,
        settings: {
          timezone: DEFAULT_TIMEZONE,
          currency: DEFAULT_CURRENCY,
          address: input.address ?? null,
          website: input.website ?? null,
        },
      }),
    );

    const team = await manager.save(
      manager.create(Team, {
        name: DEFAULT_TEAM_NAME,
        organisationId: organisation.id,
      }),
    );

    await manager.save(
      manager.create(Membership, {
        userId,
        organisationId: organisation.id,
        teamId: team.id,
        role: MembershipRole.ADMIN,
      }),
    );

    await this.auditLogService.record(manager, {
      action: 'organisation.created',
      organisationId: organisation.id,
      actorUserId: userId,
    });

    return organisation;
  }

  async findCurrentForUser(userId: string): Promise<OrganisationProfile> {
    const membership = await this.memberships.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: { organisation: true },
    });

    if (!membership) {
      throw new NotFoundException('No organisation found for this user.');
    }

    return this.toProfile(membership.organisation, membership.role);
  }

  /**
   * Authorization is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller belongs to
   * this Organisation.
   */
  async listTeams(
    organisationId: string,
  ): Promise<{ id: string; name: string }[]> {
    const teams = await this.teams.find({
      where: { organisationId },
      order: { name: 'ASC' },
    });

    return teams.map((team) => ({ id: team.id, name: team.name }));
  }

  /**
   * Authorization (does the caller hold the required role in this
   * Organisation) is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an admin.
   */
  async updateProfile(
    organisationId: string,
    dto: UpdateOrganisationDto,
  ): Promise<OrganisationProfile> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });

    if (dto.name !== undefined) {
      organisation.name = dto.name;
    }
    organisation.settings = {
      ...organisation.settings,
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.website !== undefined ? { website: dto.website } : {}),
    };

    await this.organisations.save(organisation);

    return this.toProfile(organisation, MembershipRole.ADMIN);
  }

  private toProfile(
    organisation: Organisation,
    role: MembershipRole,
  ): OrganisationProfile {
    const settings = organisation.settings as {
      address?: string | null;
      website?: string | null;
    };

    return {
      id: organisation.publicId,
      name: organisation.name,
      address: settings.address ?? null,
      website: settings.website ?? null,
      role,
    };
  }
}
