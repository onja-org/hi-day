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
import { TimesheetReason } from '../../database/entities/timesheet-reason.entity';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { UpdateOrganisationDto } from '../dto/update-organisation.dto';
import { AllowedApps, DEFAULT_ALLOWED_APPS } from '../allowed-apps';
import { DEFAULT_WORK_TIME_LIMITS } from '../work-time-limits';
import type { WorkTimeLimits } from '../work-time-limits';
import { AppUrlTracking, DEFAULT_APP_URL_TRACKING } from '../app-url-tracking';
import { CaptureSettings, DEFAULT_CAPTURE_SETTINGS } from '../capture-settings';
import { DEFAULT_WEEK_START } from '../company-profile';
import type { Industry, WeekStart } from '../company-profile';
import { DEFAULT_IDLE_POLICY, IdleHandling, IdlePolicy } from '../idle-policy';
import {
  DEFAULT_TIMESHEET_MANAGERS_APPROVE_OWN,
  DEFAULT_TIMESHEET_MODIFY_TIME,
  DEFAULT_TIMESHEET_REASONS,
  DEFAULT_TIMESHEET_REQUIRE_APPROVAL,
  DEFAULT_TIMESHEET_REQUIRE_REASON,
  TimesheetModifyTime,
} from '../timesheet-settings';
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
  industry: Industry | null;
  taxId: string | null;
  website: string | null;
  role: MembershipRole;
  idleHandling: IdleHandling;
  idleThresholdMinutes: number;
  windowTrackingEnabled: boolean;
  appUrlTracking: AppUrlTracking;
  allowedApps: AllowedApps;
  workTimeLimits: WorkTimeLimits;
  timesheetModifyTime: TimesheetModifyTime;
  /** The Modify time setting resolved for the caller, so the UI doesn't
   * combine override and default itself. Gates every role, admins too. */
  canModifyTime: boolean;
  timesheetRequireApproval: boolean;
  timesheetManagersApproveOwn: boolean;
  timesheetRequireReason: boolean;
  screenshotsEnabled: boolean;
  screenshotFrequencySeconds: number;
  screenshotRetentionDays: number;
  workingHoursPerDay: number;
  /** Falls back to UTC, the value every Organisation was created with. */
  timezone: string;
  weekStartsOn: WeekStart;
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
  industry?: Industry | null;
  taxId?: string | null;
  website?: string | null;
  weekStartsOn?: WeekStart;
  idleHandling?: IdleHandling;
  idleThresholdMinutes?: number;
  windowTrackingEnabled?: boolean;
  appUrlTracking?: AppUrlTracking;
  allowedApps?: AllowedApps;
  expectedWorkDays?: number[];
  trackingDisabledDays?: number[];
  expectedWeeklyHours?: number | null;
  weeklyLimitHours?: number | null;
  dailyLimitHours?: number | null;
  timesheetModifyTime?: TimesheetModifyTime;
  timesheetRequireApproval?: boolean;
  timesheetManagersApproveOwn?: boolean;
  timesheetRequireReason?: boolean;
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
    private readonly timeEntriesService: TimeEntriesService,
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

    // Same transaction as the Organisation itself, so the Reasons picker is
    // never empty for an org that exists.
    await manager.save(
      DEFAULT_TIMESHEET_REASONS.map((label) =>
        manager.create(TimesheetReason, {
          organisationId: organisation.id,
          label,
        }),
      ),
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

    return this.toProfile(
      membership.organisation,
      membership.role,
      userId,
      membership.timesheetModifyTime,
    );
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
      // `||`, not `??`: '' means cleared, and storing it would read back
      // as "set, but blank".
      // `null` clears too — `@IsOptional` lets it through validation.
      ...(dto.address !== undefined
        ? { address: (dto.address ?? '').trim() || null }
        : {}),
      ...(dto.industry !== undefined ? { industry: dto.industry || null } : {}),
      ...(dto.taxId !== undefined
        ? { taxId: (dto.taxId ?? '').trim() || null }
        : {}),
      ...(dto.website !== undefined
        ? { website: (dto.website ?? '').trim() || null }
        : {}),
      ...(dto.weekStartsOn !== undefined
        ? { weekStartsOn: dto.weekStartsOn }
        : {}),
      ...(dto.idleHandling !== undefined
        ? { idleHandling: dto.idleHandling }
        : {}),
      ...(dto.idleThresholdMinutes !== undefined
        ? { idleThresholdMinutes: dto.idleThresholdMinutes }
        : {}),
      ...(dto.windowTrackingEnabled !== undefined
        ? { windowTrackingEnabled: dto.windowTrackingEnabled }
        : {}),
      ...(dto.appUrlTracking !== undefined
        ? { appUrlTracking: dto.appUrlTracking }
        : {}),
      ...(dto.allowedApps !== undefined
        ? { allowedApps: dto.allowedApps }
        : {}),
      ...(dto.expectedWorkDays !== undefined
        ? { expectedWorkDays: dto.expectedWorkDays }
        : {}),
      ...(dto.trackingDisabledDays !== undefined
        ? { trackingDisabledDays: dto.trackingDisabledDays }
        : {}),
      // `null` is meaningful for all three — "removed" for the target,
      // "no limit" for the two ceilings — so they are stored as given.
      ...(dto.expectedWeeklyHours !== undefined
        ? { expectedWeeklyHours: dto.expectedWeeklyHours }
        : {}),
      ...(dto.weeklyLimitHours !== undefined
        ? { weeklyLimitHours: dto.weeklyLimitHours }
        : {}),
      ...(dto.dailyLimitHours !== undefined
        ? { dailyLimitHours: dto.dailyLimitHours }
        : {}),
      ...(dto.timesheetModifyTime !== undefined
        ? { timesheetModifyTime: dto.timesheetModifyTime }
        : {}),
      ...(dto.timesheetRequireApproval !== undefined
        ? { timesheetRequireApproval: dto.timesheetRequireApproval }
        : {}),
      ...(dto.timesheetManagersApproveOwn !== undefined
        ? { timesheetManagersApproveOwn: dto.timesheetManagersApproveOwn }
        : {}),
      ...(dto.timesheetRequireReason !== undefined
        ? { timesheetRequireReason: dto.timesheetRequireReason }
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

    if (dto.allowedApps !== undefined) {
      await this.timeEntriesService.stopEntriesDisallowedByApps(organisationId);
    }

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
   * The work time limits in force for one member: each field is their own
   * override when set, the Organisation's otherwise. Resolved here so
   * enforcement and the agent can never disagree about whose number wins.
   */
  async getWorkTimeLimits(
    organisationId: string,
    userId: string,
  ): Promise<WorkTimeLimits> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });
    const settings = organisation.settings as OrganisationSettings;
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });

    // pg returns `numeric` as a string; null stays null, since for these
    // three it means "removed" or "no limit" rather than zero.
    const toHours = (value: string | null | undefined): number | null =>
      value === null || value === undefined ? null : Number(value);

    return {
      expectedWorkDays:
        membership?.expectedWorkDays ??
        settings.expectedWorkDays ??
        DEFAULT_WORK_TIME_LIMITS.expectedWorkDays,
      trackingDisabledDays:
        membership?.trackingDisabledDays ??
        settings.trackingDisabledDays ??
        DEFAULT_WORK_TIME_LIMITS.trackingDisabledDays,
      expectedWeeklyHours:
        toHours(membership?.expectedWeeklyHours) ??
        settings.expectedWeeklyHours ??
        null,
      weeklyLimitHours:
        toHours(membership?.weeklyLimitHours) ??
        settings.weeklyLimitHours ??
        null,
      dailyLimitHours:
        toHours(membership?.dailyLimitHours) ??
        settings.dailyLimitHours ??
        null,
    };
  }

  /** Narrow, like `getIdlePolicy`: the dashboard services bucket time by
   * week and need this without the whole `OrganisationProfile`. */
  async getWeekStart(organisationId: string): Promise<WeekStart> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });
    const settings = organisation.settings as OrganisationSettings;

    return settings.weekStartsOn ?? DEFAULT_WEEK_START;
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
  /** Without `userId` only the organisation default is returned — all a
   * caller asking about the org as a whole (disclosure) needs. */
  async getCaptureSettings(
    organisationId: string,
    userId?: string,
  ): Promise<CaptureSettings> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });
    const settings = organisation.settings as OrganisationSettings;
    const membership = userId
      ? await this.memberships.findOne({
          where: {
            userId,
            organisationId,
            status: MembershipStatus.ACTIVE,
          },
        })
      : null;

    return {
      windowTrackingEnabled:
        settings.windowTrackingEnabled ??
        DEFAULT_CAPTURE_SETTINGS.windowTrackingEnabled,
      appUrlTracking:
        membership?.appUrlTracking ??
        settings.appUrlTracking ??
        DEFAULT_CAPTURE_SETTINGS.appUrlTracking,
      allowedApps:
        membership?.allowedApps ??
        settings.allowedApps ??
        DEFAULT_CAPTURE_SETTINGS.allowedApps,
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
    /** The caller's own override; `null`/omitted inherits the org default. */
    membershipModifyTime: TimesheetModifyTime | null = null,
  ): OrganisationProfile {
    const settings = organisation.settings as OrganisationSettings;
    const modifyTime =
      settings.timesheetModifyTime ?? DEFAULT_TIMESHEET_MODIFY_TIME;

    return {
      id: organisation.publicId,
      name: organisation.name,
      address: settings.address ?? null,
      industry: settings.industry ?? null,
      taxId: settings.taxId ?? null,
      website: settings.website ?? null,
      role,
      idleHandling: settings.idleHandling ?? DEFAULT_IDLE_POLICY.handling,
      idleThresholdMinutes:
        settings.idleThresholdMinutes ?? DEFAULT_IDLE_POLICY.thresholdMinutes,
      windowTrackingEnabled:
        settings.windowTrackingEnabled ??
        DEFAULT_CAPTURE_SETTINGS.windowTrackingEnabled,
      appUrlTracking: settings.appUrlTracking ?? DEFAULT_APP_URL_TRACKING,
      allowedApps: settings.allowedApps ?? DEFAULT_ALLOWED_APPS,
      workTimeLimits: {
        expectedWorkDays:
          settings.expectedWorkDays ??
          DEFAULT_WORK_TIME_LIMITS.expectedWorkDays,
        trackingDisabledDays:
          settings.trackingDisabledDays ??
          DEFAULT_WORK_TIME_LIMITS.trackingDisabledDays,
        expectedWeeklyHours: settings.expectedWeeklyHours ?? null,
        weeklyLimitHours: settings.weeklyLimitHours ?? null,
        dailyLimitHours: settings.dailyLimitHours ?? null,
      },
      timesheetModifyTime: modifyTime,
      // An admin always may; Modify time governs everyone else.
      canModifyTime:
        role === MembershipRole.ADMIN ||
        (membershipModifyTime ?? modifyTime) === 'add_edit',
      timesheetRequireApproval:
        settings.timesheetRequireApproval ?? DEFAULT_TIMESHEET_REQUIRE_APPROVAL,
      timesheetManagersApproveOwn:
        settings.timesheetManagersApproveOwn ??
        DEFAULT_TIMESHEET_MANAGERS_APPROVE_OWN,
      timesheetRequireReason:
        settings.timesheetRequireReason ?? DEFAULT_TIMESHEET_REQUIRE_REASON,
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
      weekStartsOn: settings.weekStartsOn ?? DEFAULT_WEEK_START,
      userId,
      isOwner: organisation.ownerUserId === userId,
      deletionScheduledFor:
        organisation.deletionScheduledFor?.toISOString() ?? null,
      suspendedAt: organisation.suspendedAt?.toISOString() ?? null,
      purgeAt: organisation.purgeAt?.toISOString() ?? null,
    };
  }
}
