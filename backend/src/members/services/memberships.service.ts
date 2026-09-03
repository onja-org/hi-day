import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { DevicesService } from '../../devices/services/devices.service';
import { getManagerScopeTeamId } from '../../common/manager-scope.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { UpdateMembershipDto } from '../dto/update-membership.dto';

export interface ActiveMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MembershipRole;
  teamId: string | null;
  status: MembershipStatus;
  joinedAt: Date;
}

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly devicesService: DevicesService,
  ) {}

  /**
   * Admins see every active member; managers are scoped to their own team
   * (see docs/adr/0008 for why that's `Membership.teamId` today, not a real
   * multi-team model).
   */
  async listActiveForOrganisation(
    organisationId: string,
    callerUserId: string,
  ): Promise<ActiveMemberSummary[]> {
    const caller = await this.memberships.findOne({
      where: {
        userId: callerUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }

    const where: FindOptionsWhere<Membership> = {
      organisationId,
      status: MembershipStatus.ACTIVE,
    };

    if (caller.role === MembershipRole.MANAGER) {
      const scopeTeamId = getManagerScopeTeamId(caller);
      if (scopeTeamId === null) {
        // A teamless manager manages no team, so they see no members —
        // not "no team filter", which would otherwise leak every other
        // teamless membership to them.
        return [];
      }
      where.teamId = scopeTeamId;
    }

    const memberships = await this.memberships.find({
      where,
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      teamId: membership.teamId,
      status: membership.status,
      joinedAt: membership.createdAt,
    }));
  }

  /**
   * RoleGuard/@RequireRole upstream only confirms the caller is an
   * admin/manager of this Organisation — admin has no further restriction,
   * but a manager caller is further restricted here: they can never modify
   * their own Membership or touch an admin's Membership (current or
   * requested role), and stay scoped to their own team, same as
   * listActiveForOrganisation.
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
    });

    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }

    const membership = await this.memberships.findOne({
      where: { id: membershipId, organisationId },
      relations: { user: true },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found.');
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

    if (dto.deactivate) {
      membership.status = MembershipStatus.DEACTIVATED;
      membership.deactivatedAt = new Date();
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Membership, membership);

      await this.auditLogService.record(manager, {
        action: 'membership.updated',
        organisationId,
        actorUserId,
        metadata: {
          membershipId,
          role: dto.role,
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

    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      teamId: membership.teamId,
      status: membership.status,
      joinedAt: membership.createdAt,
    };
  }

  /**
   * A manager can never modify their own Membership (self role-change/
   * deactivate is a one-way footgun — a deactivated Membership can't
   * reactivate itself). Admin access is also off-limits to managers
   * entirely: they can't touch a Membership that's currently admin, and
   * can't grant admin to anyone. They're otherwise scoped to their own
   * team, same as the member list.
   */
  private assertManagerCanModify(
    caller: Membership,
    target: Membership,
    dto: UpdateMembershipDto,
  ): void {
    if (caller.id === target.id) {
      throw new ForbiddenException(
        'Managers cannot modify their own membership.',
      );
    }

    if (
      target.role === MembershipRole.ADMIN ||
      dto.role === MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        "Managers cannot modify an admin's role or access.",
      );
    }

    const scopeTeamId = getManagerScopeTeamId(caller);
    if (scopeTeamId === null || target.teamId !== scopeTeamId) {
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
}
