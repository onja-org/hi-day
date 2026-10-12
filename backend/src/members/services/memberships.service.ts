import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { AuthService } from '../../auth/services/auth.service';
import { DevicesService } from '../../devices/services/devices.service';
import { getManagerScopeTeamIds } from '../../common/manager-scope.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { User } from '../../database/entities/user.entity';
import type { AppUrlTracking } from '../../organisations/app-url-tracking';
import type { TimesheetModifyTime } from '../../organisations/timesheet-settings';
import { UpdateMembershipDto } from '../dto/update-membership.dto';

export interface ActiveMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  teamIds: string[];
  status: MembershipStatus;
  joinedAt: Date;
  disclosureRegion: string | null;
  /** Their own IANA zone; null until a client has reported one. */
  timezone: string | null;
  /** `null` means inherit the Organisation's default. */
  appUrlTracking: AppUrlTracking | null;
  /** `null` means inherit the Organisation's Timesheets "Modify time" default. */
  timesheetModifyTime: TimesheetModifyTime | null;
  /** `null` means inherit the Organisation's Timesheets "Require approval" default. */
  timesheetRequireApproval: boolean | null;
}

/** A Members-page row — list-only, since `update()` doesn't load the
 * project memberships this count comes from. */
export interface ActiveMemberListItem extends ActiveMemberSummary {
  /** Direct ProjectMemberships only (not access via a Team), matching the
   * Projects page's Members column. */
  projectIds: string[];
}

export interface PasswordResetResult {
  membershipId: string;
  email: string | null;
  outcome: 'sent' | 'skipped';
  message?: string;
}

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly devicesService: DevicesService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Admins see every active member; managers are scoped to the team(s) they
   * manage (see docs/adr/0008 for the history of this scoping, now backed
   * by the real `team_memberships` join table).
   */
  async listActiveForOrganisation(
    organisationId: string,
    callerUserId: string,
  ): Promise<ActiveMemberListItem[]> {
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

    let memberships: Membership[];

    if (caller.role === MembershipRole.MANAGER) {
      const scopeTeamIds = getManagerScopeTeamIds(caller);
      if (scopeTeamIds.length === 0) {
        // A teamless (or non-managing) manager manages no team, so they see
        // no members — not "no team filter", which would otherwise leak
        // every other teamless membership to them.
        return [];
      }

      memberships = await this.memberships
        .createQueryBuilder('membership')
        .innerJoinAndSelect('membership.user', 'user')
        .innerJoin(
          'membership.teamMemberships',
          'scopeTm',
          'scopeTm.teamId IN (:...scopeTeamIds)',
          { scopeTeamIds },
        )
        .leftJoinAndSelect('membership.teamMemberships', 'allTm')
        .leftJoinAndSelect('membership.projectMemberships', 'projectMembership')
        .where('membership.organisationId = :organisationId', {
          organisationId,
        })
        .andWhere('membership.status = :status', {
          status: MembershipStatus.ACTIVE,
        })
        .orderBy('membership.createdAt', 'ASC')
        .getMany();
    } else {
      memberships = await this.memberships.find({
        where: { organisationId, status: MembershipStatus.ACTIVE },
        relations: {
          user: true,
          teamMemberships: true,
          projectMemberships: true,
        },
        order: { createdAt: 'ASC' },
      });
    }

    return memberships.map((membership) => ({
      ...this.toSummary(membership),
      projectIds: (membership.projectMemberships ?? []).map(
        (projectMembership) => projectMembership.projectId,
      ),
    }));
  }

  /**
   * RoleGuard/@RequireRole upstream only confirms the caller is an
   * admin/manager of this Organisation. Regardless of role, nobody can
   * change their own role or deactivate their own Membership — that's a
   * blanket rule, not a manager-specific one (self-deactivation is a
   * one-way footgun; a deactivated Membership can't reactivate itself).
   * Beyond that, an admin can freely change any *other* Membership's role
   * (including granting/demoting admin) or deactivate it. A manager
   * caller is further restricted: they can never touch an admin's
   * Membership (current or requested role), and stay scoped to the
   * team(s) they manage, same as listActiveForOrganisation.
   */
  async update(
    organisationId: string,
    membershipId: string,
    actorUserId: string,
    dto: UpdateMembershipDto,
  ): Promise<ActiveMemberSummary> {
    const caller = await this.memberships.findOne({
      where: {
        userId: actorUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { teamMemberships: true },
    });

    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }

    const membership = await this.memberships.findOne({
      where: { id: membershipId, organisationId },
      relations: { user: true, teamMemberships: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }

    if (caller.id === membership.id) {
      if (dto.role !== undefined || dto.deactivate) {
        throw new ForbiddenException(
          'You cannot change your own role or deactivate your own membership.',
        );
      }
      // Beyond the universal role/deactivate self-block above, a manager
      // can never modify their own Membership at all (see CONTEXT.md's
      // MembershipRole entry) — this covers every other editable field
      // (currently just disclosureRegion), not just role/deactivate. An
      // admin editing their own disclosureRegion is fine: there's no
      // self-demotion-style footgun in it, unlike role/deactivate.
      if (caller.role === MembershipRole.MANAGER) {
        throw new ForbiddenException(
          'Managers cannot modify their own membership.',
        );
      }
    }

    if (caller.role === MembershipRole.MANAGER) {
      this.assertManagerCanModify(caller, membership, dto);
    }

    const losesAdmin =
      membership.role === MembershipRole.ADMIN &&
      ((dto.role !== undefined && dto.role !== MembershipRole.ADMIN) ||
        dto.deactivate === true);

    if (losesAdmin) {
      await this.assertNotLastAdmin(organisationId, membershipId);
    }

    if (dto.role !== undefined) {
      membership.role = dto.role;
    }

    if (dto.disclosureRegion !== undefined) {
      membership.disclosureRegion = dto.disclosureRegion;
    }

    if (dto.appUrlTracking !== undefined) {
      membership.appUrlTracking = dto.appUrlTracking;
    }

    if (dto.timesheetModifyTime !== undefined) {
      membership.timesheetModifyTime = dto.timesheetModifyTime;
    }

    if (dto.timesheetRequireApproval !== undefined) {
      membership.timesheetRequireApproval = dto.timesheetRequireApproval;
    }

    const renames = dto.firstName !== undefined || dto.lastName !== undefined;
    if (renames) {
      const user = membership.user;
      user.firstName = dto.firstName ?? user.firstName;
      user.lastName = dto.lastName ?? user.lastName;
      user.name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    }

    if (dto.deactivate) {
      membership.status = MembershipStatus.DEACTIVATED;
      membership.deactivatedAt = new Date();
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Membership, membership);
      // Saving the Membership doesn't cascade to its User.
      if (renames) {
        await manager.save(User, membership.user);
      }

      await this.auditLogService.record(manager, {
        action: 'membership.updated',
        organisationId,
        actorUserId,
        metadata: {
          membershipId,
          role: dto.role,
          disclosureRegion: dto.disclosureRegion,
          renamed: renames,
          deactivated: dto.deactivate ?? false,
        },
      });

      if (dto.deactivate) {
        await this.devicesService.signOutAllForUser(
          manager,
          organisationId,
          membership.userId,
          actorUserId,
        );
      }
    });

    return this.toSummary(membership);
  }

  /**
   * Emails each listed member the standard password-reset link (the same
   * one "Forgot password" sends) — the caller never sees or sets anyone's
   * password. Uses the same who-can-modify-whom rules as `update`: never
   * yourself (use Forgot password instead), and a manager only for
   * non-admin members of a team they manage. Anyone not eligible, or who
   * hasn't set a password yet, is reported as skipped rather than failing
   * the whole batch.
   */
  async sendPasswordResets(
    organisationId: string,
    actorUserId: string,
    membershipIds: string[],
  ): Promise<PasswordResetResult[]> {
    const caller = await this.memberships.findOne({
      where: {
        userId: actorUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { teamMemberships: true },
    });

    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }

    const targets = await this.memberships.find({
      where: {
        id: In([...new Set(membershipIds)]),
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { user: true, teamMemberships: true },
    });
    const targetsById = new Map(targets.map((target) => [target.id, target]));

    const results: PasswordResetResult[] = [];
    for (const membershipId of new Set(membershipIds)) {
      const target = targetsById.get(membershipId);
      if (!target) {
        results.push({
          membershipId,
          email: null,
          outcome: 'skipped',
          message: 'Member not found.',
        });
        continue;
      }

      const email = target.user.email;
      const skip = (message: string) =>
        results.push({ membershipId, email, outcome: 'skipped', message });

      if (target.id === caller.id) {
        skip('Use "Forgot password" to reset your own password.');
        continue;
      }
      if (
        caller.role === MembershipRole.MANAGER &&
        !this.managerCanModify(caller, target, undefined)
      ) {
        skip('You can only reset passwords for members of your own team.');
        continue;
      }
      if (!target.user.passwordHash) {
        skip("This person hasn't set a password yet.");
        continue;
      }

      await this.authService.forgotPassword({ email });
      await this.dataSource.transaction((manager) =>
        this.auditLogService.record(manager, {
          action: 'membership.password_reset_sent',
          organisationId,
          actorUserId,
          metadata: { membershipId },
        }),
      );
      results.push({ membershipId, email, outcome: 'sent' });
    }

    return results;
  }

  /** The non-throwing form of `assertManagerCanModify`. */
  private managerCanModify(
    caller: Membership,
    target: Membership,
    requestedRole: MembershipRole | undefined,
  ): boolean {
    try {
      this.assertManagerCanModify(caller, target, { role: requestedRole });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Self-modification is already blocked universally above. Beyond that,
   * admin access is off-limits to managers entirely: they can't touch a
   * Membership that's currently admin, and can't grant admin to anyone.
   * They're otherwise scoped to the team(s) they manage, same as the
   * member list.
   */
  private assertManagerCanModify(
    caller: Membership,
    target: Membership,
    dto: UpdateMembershipDto,
  ): void {
    if (
      target.role === MembershipRole.ADMIN ||
      dto.role === MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        "Managers cannot modify an admin's role or access.",
      );
    }

    const scopeTeamIds = getManagerScopeTeamIds(caller);
    const targetTeamIds = (target.teamMemberships ?? []).map(
      (teamMembership) => teamMembership.teamId,
    );
    const sharesManagedTeam = targetTeamIds.some((teamId) =>
      scopeTeamIds.includes(teamId),
    );

    if (scopeTeamIds.length === 0 || !sharesManagedTeam) {
      throw new ForbiddenException(
        'You can only manage members on your own team.',
      );
    }
  }

  private async assertNotLastAdmin(
    organisationId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const remainingAdmins = await this.memberships.count({
      where: {
        organisationId,
        role: MembershipRole.ADMIN,
        status: MembershipStatus.ACTIVE,
        id: Not(excludingMembershipId),
      },
    });

    if (remainingAdmins === 0) {
      throw new ConflictException(
        'This organisation must always have at least one active admin.',
      );
    }
  }

  private toSummary(membership: Membership): ActiveMemberSummary {
    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      timezone: membership.user.timezone,
      role: membership.role,
      teamIds: (membership.teamMemberships ?? []).map(
        (teamMembership) => teamMembership.teamId,
      ),
      status: membership.status,
      joinedAt: membership.createdAt,
      disclosureRegion: membership.disclosureRegion,
      appUrlTracking: membership.appUrlTracking,
      timesheetModifyTime: membership.timesheetModifyTime,
      timesheetRequireApproval: membership.timesheetRequireApproval,
    };
  }

  /**
   * Admin-only bulk-reset: clears every Membership's `appUrlTracking`
   * override for this Organisation, so each one falls back to the org
   * default. Backs the "Apply to all" button on the Track apps & URLs
   * setting — one UPDATE rather than N PATCHes from the client.
   */
  async resetAllAppUrlTrackingOverrides(
    organisationId: string,
    actorUserId: string,
  ): Promise<{ cleared: number }> {
    const result = await this.memberships
      .createQueryBuilder()
      .update(Membership)
      .set({ appUrlTracking: null })
      .where('organisationId = :organisationId', { organisationId })
      .andWhere('appUrlTracking IS NOT NULL')
      .execute();

    const cleared = result.affected ?? 0;
    if (cleared > 0) {
      await this.dataSource.transaction((manager) =>
        this.auditLogService.record(manager, {
          action: 'membership.app_url_tracking_overrides_reset',
          organisationId,
          actorUserId,
          metadata: { cleared },
        }),
      );
    }

    return { cleared };
  }

  /**
   * Admin-only bulk-reset for Timesheets per-member overrides. Clears both
   * `timesheetModifyTime` and `timesheetRequireApproval` for every member
   * in this Organisation in one UPDATE — backs the "Apply to all" button
   * on the Modify time (manual time) setting.
   */
  async resetAllTimesheetOverrides(
    organisationId: string,
    actorUserId: string,
  ): Promise<{ cleared: number }> {
    const result = await this.memberships
      .createQueryBuilder()
      .update(Membership)
      .set({ timesheetModifyTime: null, timesheetRequireApproval: null })
      .where('organisationId = :organisationId', { organisationId })
      .andWhere(
        '(timesheetModifyTime IS NOT NULL OR timesheetRequireApproval IS NOT NULL)',
      )
      .execute();

    const cleared = result.affected ?? 0;
    if (cleared > 0) {
      await this.dataSource.transaction((manager) =>
        this.auditLogService.record(manager, {
          action: 'membership.timesheet_overrides_reset',
          organisationId,
          actorUserId,
          metadata: { cleared },
        }),
      );
    }

    return { cleared };
  }
}
