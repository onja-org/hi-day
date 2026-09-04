import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Team } from '../../database/entities/team.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { AddTeamMemberDto } from '../dto/add-team-member.dto';
import { CreateTeamDto } from '../dto/create-team.dto';
import { UpdateTeamDto } from '../dto/update-team.dto';

export interface TeamSummary {
  id: string;
  name: string;
}

export interface TeamMemberDetail {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  isManager: boolean;
}

export interface TeamDetail {
  id: string;
  name: string;
  members: TeamMemberDetail[];
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TeamMembership)
    private readonly teamMemberships: Repository<TeamMembership>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Authorization (caller is an org admin) is enforced upstream by
   * RoleGuard/@RequireRole on the route.
   */
  async create(
    organisationId: string,
    actorUserId: string,
    dto: CreateTeamDto,
  ): Promise<TeamSummary> {
    await this.assertNameAvailable(organisationId, dto.name);

    let team!: Team;

    await this.dataSource.transaction(async (manager) => {
      team = await manager.save(
        manager.create(Team, { name: dto.name, organisationId }),
      );

      await this.auditLogService.record(manager, {
        action: 'team.created',
        organisationId,
        actorUserId,
        metadata: { teamId: team.id, name: team.name },
      });
    });

    return { id: team.id, name: team.name };
  }

  async update(
    organisationId: string,
    teamId: string,
    actorUserId: string,
    dto: UpdateTeamDto,
  ): Promise<TeamSummary> {
    const team = await this.findTeamOrFail(organisationId, teamId);

    await this.assertNameAvailable(organisationId, dto.name, teamId);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Team, teamId, { name: dto.name });

      await this.auditLogService.record(manager, {
        action: 'team.updated',
        organisationId,
        actorUserId,
        metadata: { teamId, name: dto.name },
      });
    });

    return { id: team.id, name: dto.name };
  }

  async remove(
    organisationId: string,
    teamId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.findTeamOrFail(organisationId, teamId);

    const remainingTeams = await this.teams.count({
      where: { organisationId, id: Not(teamId) },
    });

    if (remainingTeams === 0) {
      throw new ConflictException(
        'This organisation must always have at least one team.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // FK `ON DELETE CASCADE` on team_memberships.teamId detaches every
      // member automatically — their Membership rows are untouched.
      await manager.delete(Team, teamId);

      await this.auditLogService.record(manager, {
        action: 'team.deleted',
        organisationId,
        actorUserId,
        metadata: { teamId },
      });
    });
  }

  async getDetail(organisationId: string, teamId: string): Promise<TeamDetail> {
    const team = await this.teams.findOne({
      where: { id: teamId, organisationId },
      relations: { teamMemberships: { membership: { user: true } } },
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    return {
      id: team.id,
      name: team.name,
      members: team.teamMemberships.map((teamMembership) => ({
        membershipId: teamMembership.membershipId,
        userId: teamMembership.membership.userId,
        name: teamMembership.membership.user.name,
        email: teamMembership.membership.user.email,
        isManager: teamMembership.isManager,
      })),
    };
  }

  /**
   * Adds `dto.membershipId` to the team, or updates its `isManager` flag in
   * place if it's already a member — this upsert is also how "assign a
   * manager" is expressed, since there's no separate endpoint for it.
   */
  async addOrUpdateMember(
    organisationId: string,
    teamId: string,
    actorUserId: string,
    dto: AddTeamMemberDto,
  ): Promise<void> {
    await this.findTeamOrFail(organisationId, teamId);

    const membership = await this.memberships.findOne({
      where: {
        id: dto.membershipId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }

    const existing = await this.teamMemberships.findOne({
      where: { teamId, membershipId: dto.membershipId },
    });

    await this.dataSource.transaction(async (manager) => {
      if (existing) {
        await manager.update(TeamMembership, existing.id, {
          isManager: dto.isManager ?? existing.isManager,
        });
      } else {
        await manager.save(
          manager.create(TeamMembership, {
            teamId,
            membershipId: dto.membershipId,
            isManager: dto.isManager ?? false,
          }),
        );
      }

      await this.auditLogService.record(manager, {
        action: 'team.member_added',
        organisationId,
        actorUserId,
        metadata: {
          teamId,
          membershipId: dto.membershipId,
          isManager: dto.isManager ?? existing?.isManager ?? false,
        },
      });
    });
  }

  async removeMember(
    organisationId: string,
    teamId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.findTeamOrFail(organisationId, teamId);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(TeamMembership, { teamId, membershipId });

      await this.auditLogService.record(manager, {
        action: 'team.member_removed',
        organisationId,
        actorUserId,
        metadata: { teamId, membershipId },
      });
    });
  }

  private async findTeamOrFail(
    organisationId: string,
    teamId: string,
  ): Promise<Team> {
    const team = await this.teams.findOne({
      where: { id: teamId, organisationId },
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    return team;
  }

  private async assertNameAvailable(
    organisationId: string,
    name: string,
    excludingTeamId?: string,
  ): Promise<void> {
    const existing = await this.teams.findOne({
      where: {
        organisationId,
        name,
        ...(excludingTeamId ? { id: Not(excludingTeamId) } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        'A team with this name already exists in this organisation.',
      );
    }
  }
}
