import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { TokenService } from '../../auth/services/token.service';
import { InviteLink } from '../../database/entities/invite-link.entity';
import { Invitation } from '../../database/entities/invitation.entity';
import { InvitationStatus } from '../../database/entities/invitation-status.enum';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { Team } from '../../database/entities/team.entity';
import { CreateInviteLinkDto } from '../dto/create-invite-link.dto';
import { UpdateInviteLinkDto } from '../dto/update-invite-link.dto';
import {
  computeInviteLinkStatus,
  InviteLinkStatus,
} from '../invite-link-status.util';
import { InvitationsService } from './invitations.service';

export interface InviteLinkSummary {
  id: string;
  name: string;
  role: MembershipRole;
  teamIds: string[];
  projectIds: string[];
  expiresAt: Date | null;
  usageCap: number | null;
  usageCount: number;
  enabled: boolean;
  status: InviteLinkStatus;
  token: string;
  createdAt: Date;
}

export interface InviteLinkPreview {
  status: InviteLinkStatus | 'not_found';
  organisationName?: string;
  role?: MembershipRole;
}

/**
 * Admins see and manage every link in the organisation. A manager sees and
 * manages only the links they created, and can only attach teams they
 * manage — a link's teams would otherwise reveal teams the manager can't
 * list. Every query is scoped by organisationId.
 */
@Injectable()
export class InviteLinksService {
  constructor(
    @InjectRepository(InviteLink)
    private readonly inviteLinks: Repository<InviteLink>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tokenService: TokenService,
    private readonly auditLogService: AuditLogService,
    private readonly invitationsService: InvitationsService,
  ) {}

  async list(
    organisationId: string,
    callerUserId: string,
  ): Promise<InviteLinkSummary[]> {
    const caller = await this.getCaller(organisationId, callerUserId);
    const links = await this.inviteLinks.find({
      where:
        caller.role === MembershipRole.ADMIN
          ? { organisationId }
          : { organisationId, createdByUserId: callerUserId },
      order: { createdAt: 'DESC' },
    });
    const existingTeamIds = new Set(
      (await this.teams.find({ where: { organisationId } })).map((t) => t.id),
    );
    const now = new Date();
    return links.map((link) => this.toSummary(link, existingTeamIds, now));
  }

  async create(
    organisationId: string,
    callerUserId: string,
    dto: CreateInviteLinkDto,
  ): Promise<InviteLinkSummary> {
    const caller = await this.getCaller(organisationId, callerUserId);
    const teamIds = [...new Set(dto.teamIds ?? [])];
    const projectIds = [...new Set(dto.projectIds ?? [])];
    await this.assertAssignable(organisationId, caller, teamIds, projectIds);

    const link = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(InviteLink, {
          organisationId,
          name: dto.name,
          role: dto.role,
          teamIds,
          projectIds,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          usageCap: dto.usageCap ?? null,
          enabled: dto.enabled ?? true,
          token: this.tokenService.generateToken(),
          createdByUserId: callerUserId,
        }),
      );
      await this.auditLogService.record(manager, {
        action: 'invite_link.created',
        organisationId,
        actorUserId: callerUserId,
        metadata: { inviteLinkId: saved.id, role: saved.role },
      });
      return saved;
    });

    return this.toSummary(link, new Set(teamIds), new Date());
  }

  async update(
    organisationId: string,
    linkId: string,
    callerUserId: string,
    dto: UpdateInviteLinkDto,
  ): Promise<InviteLinkSummary> {
    const caller = await this.getCaller(organisationId, callerUserId);
    const link = await this.getManageableLink(organisationId, linkId, caller);

    const teamIds = dto.teamIds ? [...new Set(dto.teamIds)] : link.teamIds;
    const projectIds = dto.projectIds
      ? [...new Set(dto.projectIds)]
      : link.projectIds;
    await this.assertAssignable(
      organisationId,
      caller,
      dto.teamIds ? teamIds : [],
      dto.projectIds ? projectIds : [],
    );

    if (dto.name !== undefined) link.name = dto.name;
    if (dto.role !== undefined) link.role = dto.role;
    link.teamIds = teamIds;
    link.projectIds = projectIds;
    if (dto.expiresAt !== undefined) {
      link.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.usageCap !== undefined) link.usageCap = dto.usageCap;
    if (dto.enabled !== undefined) link.enabled = dto.enabled;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(InviteLink, link);
      await this.auditLogService.record(manager, {
        action: 'invite_link.updated',
        organisationId,
        actorUserId: callerUserId,
        metadata: { inviteLinkId: link.id, enabled: link.enabled },
      });
    });

    const existingTeamIds = new Set(
      (await this.teams.find({ where: { organisationId } })).map((t) => t.id),
    );
    return this.toSummary(link, existingTeamIds, new Date());
  }

  /** Deletes the link and revokes invitations still pending through it. */
  async remove(
    organisationId: string,
    linkId: string,
    callerUserId: string,
  ): Promise<void> {
    const caller = await this.getCaller(organisationId, callerUserId);
    const link = await this.getManageableLink(organisationId, linkId, caller);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Invitation,
        {
          organisationId,
          inviteLinkId: link.id,
          status: InvitationStatus.PENDING,
        },
        { status: InvitationStatus.REVOKED },
      );
      await manager.delete(InviteLink, { id: link.id, organisationId });
      await this.auditLogService.record(manager, {
        action: 'invite_link.deleted',
        organisationId,
        actorUserId: callerUserId,
        metadata: { inviteLinkId: link.id },
      });
    });
  }

  async getPreview(token: string): Promise<InviteLinkPreview> {
    const link = await this.inviteLinks.findOne({
      where: { token },
      relations: { organisation: true },
    });
    if (!link) {
      return { status: 'not_found' };
    }
    return {
      status: computeInviteLinkStatus(link, new Date()),
      organisationName: link.organisation.name,
      role: link.role,
    };
  }

  /**
   * Sends an ordinary invitation carrying the link's settings, if the link
   * is usable. Resolves the same way whether or not an email went out, so
   * the caller can answer with one generic message either way.
   */
  async requestJoin(token: string, email: string): Promise<void> {
    const link = await this.inviteLinks.findOne({ where: { token } });
    if (!link || computeInviteLinkStatus(link, new Date()) !== 'active') {
      return;
    }
    await this.invitationsService.requestViaInviteLink(link, email);
  }

  private async getCaller(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const caller = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
      relations: { teamMemberships: true },
    });
    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }
    return caller;
  }

  private async getManageableLink(
    organisationId: string,
    linkId: string,
    caller: Membership,
  ): Promise<InviteLink> {
    const link = await this.inviteLinks.findOne({
      where:
        caller.role === MembershipRole.ADMIN
          ? { id: linkId, organisationId }
          : { id: linkId, organisationId, createdByUserId: caller.userId },
    });
    if (!link) {
      throw new NotFoundException('Invite link not found.');
    }
    return link;
  }

  private async assertAssignable(
    organisationId: string,
    caller: Membership,
    teamIds: string[],
    projectIds: string[],
  ): Promise<void> {
    if (teamIds.length > 0) {
      const teamCount = await this.teams.count({
        where: { id: In(teamIds), organisationId },
      });
      if (teamCount !== teamIds.length) {
        throw new BadRequestException('One or more teams were not found.');
      }
      if (caller.role !== MembershipRole.ADMIN) {
        const managedTeamIds = new Set(
          (caller.teamMemberships ?? [])
            .filter((teamMembership) => teamMembership.isManager)
            .map((teamMembership) => teamMembership.teamId),
        );
        if (teamIds.some((teamId) => !managedTeamIds.has(teamId))) {
          throw new ForbiddenException(
            'You can only add teams you manage to an invite link.',
          );
        }
      }
    }

    if (projectIds.length > 0) {
      const projectCount = await this.projects.count({
        where: { id: In(projectIds), organisationId, archivedAt: IsNull() },
      });
      if (projectCount !== projectIds.length) {
        throw new BadRequestException(
          'One or more projects were not found or are archived.',
        );
      }
    }
  }

  private toSummary(
    link: InviteLink,
    existingTeamIds: Set<string>,
    now: Date,
  ): InviteLinkSummary {
    return {
      id: link.id,
      name: link.name,
      role: link.role,
      teamIds: link.teamIds.filter((teamId) => existingTeamIds.has(teamId)),
      projectIds: link.projectIds,
      expiresAt: link.expiresAt,
      usageCap: link.usageCap,
      usageCount: link.usageCount,
      enabled: link.enabled,
      status: computeInviteLinkStatus(link, now),
      token: link.token,
      createdAt: link.createdAt,
    };
  }
}
