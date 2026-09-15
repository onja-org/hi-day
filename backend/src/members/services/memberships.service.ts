import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { DevicesService } from '../../devices/services/devices.service';
import { getManagerScopeTeamIds } from '../../common/manager-scope.util';
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
  teamIds: string[];
  status: MembershipStatus;
  joinedAt: Date;
  disclosureRegion: string | null;
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
   * Admins see every active member; managers are scoped to the team(s) they
   * manage (see docs/adr/0008 for the history of this scoping, now backed
   * by the real `team_memberships` join table).
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
        relations: { user: true, teamMemberships: true },
        order: { createdAt: 'ASC' },
      });
    }

    return memberships.map((membership) => this.toSummary(membership));
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
          disclosureRegion: dto.disclosureRegion,
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
      role: membership.role,
      teamIds: (membership.teamMemberships ?? []).map(
        (teamMembership) => teamMembership.teamId,
      ),
      status: membership.status,
      joinedAt: membership.createdAt,
      disclosureRegion: membership.disclosureRegion,
    };
  }
}
