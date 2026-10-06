import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { OrganisationRegion } from '../../database/entities/organisation-region.enum';
import { Team } from '../../database/entities/team.entity';
import { UpdateOrganisationDto } from '../dto/update-organisation.dto';
import { CaptureSettings, DEFAULT_CAPTURE_SETTINGS } from '../capture-settings';
import { DEFAULT_IDLE_POLICY, IdleHandling, IdlePolicy } from '../idle-policy';
import { generateSlug } from '../slug.util';
import {
  DEFAULT_WORKING_HOURS_POLICY,
  WorkingHoursPolicy,
} from '../working-hours-policy';

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
  idleHandling: IdleHandling;
  idleThresholdMinutes: number;
  windowTrackingEnabled: boolean;
  screenshotsEnabled: boolean;
  screenshotFrequencySeconds: number;
  screenshotRetentionDays: number;
  workingHoursPerDay: number;
  /** Falls back to UTC, the value every Organisation was created with. */
  timezone: string;
  userId: string;
  /** Only the owner may start or cancel account deletion. */
  isOwner: boolean;
  /** ISO timestamps; all `null` for a normal active organisation. */
  deletionScheduledFor: string | null;
  suspendedAt: string | null;
  purgeAt: string | null;
}

interface OrganisationSettings {
  address?: string | null;
  website?: string | null;
  idleHandling?: IdleHandling;
  idleThresholdMinutes?: number;
  windowTrackingEnabled?: boolean;
  screenshotsEnabled?: boolean;
  screenshotFrequencySeconds?: number;
  screenshotRetentionDays?: number;
  workingHoursPerDay?: number;
  timezone?: string;
}

export interface TeamOverviewMember {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  isManager: boolean;
}

export interface TeamOverview {
  id: string;
  name: string;
  members: TeamOverviewMember[];
  projectCount: number;
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
        ownerUserId: userId,
        settings: {
          timezone: DEFAULT_TIMEZONE,
          currency: DEFAULT_CURRENCY,
          address: input.address ?? null,
          website: input.website ?? null,
        },
      }),
    );

    await manager.save(
      manager.create(Team, {
        name: DEFAULT_TEAM_NAME,
        organisationId: organisation.id,
      }),
    );

    // The founding admin gets no `team_memberships` row — admins see every
    // team in the Organisation by role, not by team membership.
    await manager.save(
      manager.create(Membership, {
        userId,
        organisationId: organisation.id,
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
    // Someone in two Organisations lands in one that still works, rather
    // than one being deleted under them (ADR-0023).
    const membership = await this.memberships.findOne({
      where: { userId, status: MembershipStatus.ACTIVE },
      relations: { organisation: true },
      order: {
        organisation: { suspendedAt: { direction: 'ASC', nulls: 'FIRST' } },
      },
    });

    if (!membership) {
      throw new NotFoundException('No organisation found for this user.');
    }

    return this.toProfile(membership.organisation, membership.role, userId);
  }

  /**
   * "Teams" is a personal space, same as Activity/dashboard: an admin sees
   * every team in the Organisation (they manage the whole org), but anyone
   * else only sees the team(s) they themselves belong to, via
   * `Membership.teamMemberships`. This also governs which teams a manager's
   * invite-form UI offers for a new invite (not backend-enforced today —
   * see docs/adr/0008).
   */
  /**
   * Every team the caller can see, with its roster and how many projects
   * it's assigned to — enough for the Teams page's avatar/count columns.
   * Visibility matches TeamViewGuard: an admin sees every team, anyone else
   * only the teams they belong to, so no roster is exposed here that the
   * caller couldn't already open on that team's own page.
   */
  async listTeams(
    organisationId: string,
    callerUserId: string,
  ): Promise<TeamOverview[]> {
    const caller = await this.memberships.findOne({
      where: {
        userId: callerUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { teamMemberships: true },
    });

    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }

    let teamIdFilter: string[] | undefined;
    if (caller.role !== MembershipRole.ADMIN) {
      teamIdFilter = caller.teamMemberships.map(
        (teamMembership) => teamMembership.teamId,
      );

      if (teamIdFilter.length === 0) {
        return [];
      }
    }

    const teams = await this.teams.find({
      where: teamIdFilter
        ? { id: In(teamIdFilter), organisationId }
        : { organisationId },
      relations: {
        teamMemberships: { membership: { user: true } },
        projectTeams: true,
      },
      order: { name: 'ASC' },
    });

    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      members: (team.teamMemberships ?? []).map((teamMembership) => ({
        membershipId: teamMembership.membershipId,
        userId: teamMembership.membership.userId,
        name: teamMembership.membership.user.name,
        email: teamMembership.membership.user.email,
        isManager: teamMembership.isManager,
      })),
      projectCount: (team.projectTeams ?? []).length,
    }));
  }

  /**
   * Authorization (does the caller hold the required role in this
   * Organisation) is enforced upstream by RoleGuard/@RequireRole on the
   * route — reaching this method already implies the caller is an admin.
   */
  async updateProfile(
    organisationId: string,
    userId: string,
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
      ...(dto.idleHandling !== undefined
        ? { idleHandling: dto.idleHandling }
        : {}),
      ...(dto.idleThresholdMinutes !== undefined
        ? { idleThresholdMinutes: dto.idleThresholdMinutes }
        : {}),
      ...(dto.windowTrackingEnabled !== undefined
        ? { windowTrackingEnabled: dto.windowTrackingEnabled }
        : {}),
      ...(dto.screenshotsEnabled !== undefined
        ? { screenshotsEnabled: dto.screenshotsEnabled }
        : {}),
      ...(dto.screenshotFrequencySeconds !== undefined
        ? { screenshotFrequencySeconds: dto.screenshotFrequencySeconds }
        : {}),
      ...(dto.screenshotRetentionDays !== undefined
        ? { screenshotRetentionDays: dto.screenshotRetentionDays }
        : {}),
      ...(dto.workingHoursPerDay !== undefined
        ? { workingHoursPerDay: dto.workingHoursPerDay }
        : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
    };

    await this.organisations.save(organisation);

    return this.toProfile(organisation, MembershipRole.ADMIN, userId);
  }

  /**
   * Read by the desktop agent (via DeviceTrackingController) to decide how
   * to react to idle time — kept as its own narrow method rather than
   * making device routes depend on the full `OrganisationProfile` shape.
   */
  async getIdlePolicy(organisationId: string): Promise<IdlePolicy> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });
    const settings = organisation.settings as OrganisationSettings;

    return {
      handling: settings.idleHandling ?? DEFAULT_IDLE_POLICY.handling,
      thresholdMinutes:
        settings.idleThresholdMinutes ?? DEFAULT_IDLE_POLICY.thresholdMinutes,
    };
  }

  /**
   * Read by other services (e.g. the dashboard summary) that need the
   * daily-hours target without depending on the full `OrganisationProfile`
   * shape — same rationale as `getIdlePolicy`. Informational only: nothing
   * enforces this as a cap anywhere.
   */
  async getWorkingHoursPolicy(
    organisationId: string,
  ): Promise<WorkingHoursPolicy> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });
    const settings = organisation.settings as OrganisationSettings;

    return {
      hoursPerDay:
        settings.workingHoursPerDay ?? DEFAULT_WORKING_HOURS_POLICY.hoursPerDay,
    };
  }

  /**
   * Read by the desktop agent (via DeviceTrackingController) to decide
   * whether to run its local window-tracking sampling loop — kept as its
   * own narrow method rather than making device routes depend on the full
   * `OrganisationProfile` shape (same rationale as `getIdlePolicy`).
   */
  async getCaptureSettings(organisationId: string): Promise<CaptureSettings> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });
    const settings = organisation.settings as OrganisationSettings;

    return {
      windowTrackingEnabled:
        settings.windowTrackingEnabled ??
        DEFAULT_CAPTURE_SETTINGS.windowTrackingEnabled,
      screenshotsEnabled:
        settings.screenshotsEnabled ??
        DEFAULT_CAPTURE_SETTINGS.screenshotsEnabled,
      screenshotFrequencySeconds:
        settings.screenshotFrequencySeconds ??
        DEFAULT_CAPTURE_SETTINGS.screenshotFrequencySeconds,
      screenshotRetentionDays:
        settings.screenshotRetentionDays ??
        DEFAULT_CAPTURE_SETTINGS.screenshotRetentionDays,
    };
  }

  private toProfile(
    organisation: Organisation,
    role: MembershipRole,
    userId: string,
  ): OrganisationProfile {
    const settings = organisation.settings as OrganisationSettings;

    return {
      id: organisation.publicId,
      name: organisation.name,
      address: settings.address ?? null,
      website: settings.website ?? null,
      role,
      idleHandling: settings.idleHandling ?? DEFAULT_IDLE_POLICY.handling,
      idleThresholdMinutes:
        settings.idleThresholdMinutes ?? DEFAULT_IDLE_POLICY.thresholdMinutes,
      windowTrackingEnabled:
        settings.windowTrackingEnabled ??
        DEFAULT_CAPTURE_SETTINGS.windowTrackingEnabled,
      screenshotsEnabled:
        settings.screenshotsEnabled ??
        DEFAULT_CAPTURE_SETTINGS.screenshotsEnabled,
      screenshotFrequencySeconds:
        settings.screenshotFrequencySeconds ??
        DEFAULT_CAPTURE_SETTINGS.screenshotFrequencySeconds,
      screenshotRetentionDays:
        settings.screenshotRetentionDays ??
        DEFAULT_CAPTURE_SETTINGS.screenshotRetentionDays,
      workingHoursPerDay:
        settings.workingHoursPerDay ?? DEFAULT_WORKING_HOURS_POLICY.hoursPerDay,
      timezone: settings.timezone ?? DEFAULT_TIMEZONE,
      userId,
      isOwner: organisation.ownerUserId === userId,
      deletionScheduledFor:
        organisation.deletionScheduledFor?.toISOString() ?? null,
      suspendedAt: organisation.suspendedAt?.toISOString() ?? null,
      purgeAt: organisation.purgeAt?.toISOString() ?? null,
    };
  }
}
