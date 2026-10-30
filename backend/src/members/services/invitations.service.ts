import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { isEmail } from 'class-validator';
import type { Request, Response } from 'express';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { BilledSeatsService } from '../../billing/services/billed-seats.service';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { recordAnalyticsEvent } from '../../common/analytics';
import { hashToken } from '../../common/hash-token.util';
import { readCookie } from '../../common/cookies.util';
import { setSessionCookies } from '../../common/session-cookies.util';
import { PasswordService } from '../../auth/services/password.service';
import { RefreshTokenService } from '../../auth/services/refresh-token.service';
import {
  ACCESS_TOKEN_COOKIE,
  TokenService,
} from '../../auth/services/token.service';
import { JwtService } from '@nestjs/jwt';
import { InviteLink } from '../../database/entities/invite-link.entity';
import { Invitation } from '../../database/entities/invitation.entity';
import { InvitationStatus } from '../../database/entities/invitation-status.enum';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { Project } from '../../database/entities/project.entity';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';
import { Team } from '../../database/entities/team.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { User } from '../../database/entities/user.entity';
import { EmailService } from '../../email/services/email.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CreateInvitationEntryDto } from '../dto/create-invitation-entry.dto';
import {
  computeEffectiveInvitationStatus,
  EffectiveInvitationStatus,
} from '../effective-invitation-status.util';
import { computeInviteLinkStatus } from '../invite-link-status.util';

const DEFAULT_INVITATION_TTL_HOURS = 72;
const MS_PER_HOUR = 60 * 60 * 1000;
const INVALID_OR_EXPIRED_LINK_MESSAGE = 'This link is invalid or has expired.';
const INVITE_LINK_INACTIVE_MESSAGE =
  'The invite link this invitation came from is no longer active. Ask an admin for a new invite.';
// A repeat join request through the same link resends at most this often.
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;

export type InvitationOutcome =
  'sent' | 'resent' | 'already_member' | 'invalid';

export interface InvitationEntryResult {
  email: string;
  outcome: InvitationOutcome;
  message?: string;
}

export interface InvitationSummary {
  id: string;
  email: string;
  role: MembershipRole;
  teamIds: string[];
  projectIds: string[];
  status: EffectiveInvitationStatus;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface InvitationPreview {
  status: EffectiveInvitationStatus | 'not_found';
  email?: string;
  organisationName?: string;
  role?: MembershipRole;
  teamNames?: string[];
  accountAlreadyExists?: boolean;
}

@Injectable()
export class InvitationsService {
  constructor(
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(InviteLink)
    private readonly inviteLinks: Repository<InviteLink>,
    private readonly billedSeatsService: BilledSeatsService,
  ) {}

  async createMany(
    organisationId: string,
    actorUserId: string,
    entries: CreateInvitationEntryDto[],
  ): Promise<InvitationEntryResult[]> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });

    // RoleGuard upstream only confirms admin-or-manager; a manager still
    // can't hand out admin access by inviting someone as admin — the same
    // rule MembershipsService.update enforces for role changes.
    const caller = await this.memberships.findOne({
      where: {
        userId: actorUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
    });
    const callerIsAdmin = caller?.role === MembershipRole.ADMIN;

    const results: InvitationEntryResult[] = [];

    for (const entry of entries) {
      if (entry.role === MembershipRole.ADMIN && !callerIsAdmin) {
        results.push({
          email: entry.email.trim().toLowerCase(),
          outcome: 'invalid',
          message: 'Only an admin can invite someone as an admin.',
        });
        continue;
      }
      results.push(
        await this.upsertInvitation(organisation, actorUserId, entry),
      );
    }

    return results;
  }

  /**
   * Re-sends the exact invitation row identified by `invitationId` — unlike
   * `createMany`/`upsertInvitation` (which look a row up by email and only
   * reuse it if still pending), this always revives *that* row, whatever
   * its current status, so resending a revoked or expired invitation
   * doesn't leave the old row behind while creating a second one.
   */
  async resend(
    organisationId: string,
    invitationId: string,
    actorUserId: string,
  ): Promise<InvitationEntryResult> {
    const invitation = await this.invitations.findOne({
      where: { id: invitationId, organisationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    const activeMember = await this.findActiveMemberByEmail(
      organisationId,
      invitation.email,
    );

    if (activeMember) {
      return {
        email: invitation.email,
        outcome: 'already_member',
        message: 'This person is already a member of this organisation.',
      };
    }

    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });

    return this.stampAndSendToken(
      organisation,
      invitation.id,
      invitation.email,
      invitation.role,
      invitation.teamIds ?? [],
      invitation.projectIds ?? [],
      actorUserId,
    );
  }

  async revoke(
    organisationId: string,
    invitationId: string,
    actorUserId: string,
  ): Promise<void> {
    const invitation = await this.invitations.findOne({
      where: { id: invitationId, organisationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException('This invitation has already been accepted.');
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Invitation, invitation.id, {
        status: InvitationStatus.REVOKED,
      });

      await this.auditLogService.record(manager, {
        action: 'invitation.revoked',
        organisationId,
        actorUserId,
        metadata: { email: invitation.email },
      });
    });
  }

  async listForOrganisation(
    organisationId: string,
  ): Promise<InvitationSummary[]> {
    const invitations = await this.invitations.find({
      where: { organisationId },
      order: { createdAt: 'DESC' },
    });
    // teamIds has no foreign key, so drop ids of since-deleted teams.
    const existingTeamIds = new Set(
      (await this.teams.find({ where: { organisationId } })).map(
        (team) => team.id,
      ),
    );

    const now = new Date();

    return invitations
      .filter((invitation) => invitation.status !== InvitationStatus.ACCEPTED)
      .map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        teamIds: (invitation.teamIds ?? []).filter((id) =>
          existingTeamIds.has(id),
        ),
        projectIds: invitation.projectIds ?? [],
        status: computeEffectiveInvitationStatus(invitation, now),
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      }));
  }

  async getPreview(token: string): Promise<InvitationPreview> {
    const invitation = await this.invitations.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { organisation: true },
    });

    if (!invitation) {
      return { status: 'not_found' };
    }

    const status = computeEffectiveInvitationStatus(invitation, new Date());
    const invitedUser = await this.users.findOne({
      where: { email: invitation.email },
    });
    const teamIds = invitation.teamIds ?? [];
    const teams = teamIds.length
      ? await this.teams.find({
          where: { id: In(teamIds), organisationId: invitation.organisationId },
          order: { name: 'ASC' },
        })
      : [];

    return {
      status,
      email: invitation.email,
      organisationName: invitation.organisation.name,
      role: invitation.role,
      teamNames: teams.map((team) => team.name),
      accountAlreadyExists: Boolean(invitedUser?.passwordHash),
    };
  }

  async accept(
    token: string,
    dto: AcceptInvitationDto,
    request: Request,
    response: Response,
  ): Promise<{ message: string }> {
    const invitation = await this.invitations.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { organisation: true },
    });

    if (
      !invitation ||
      invitation.organisation.suspendedAt ||
      computeEffectiveInvitationStatus(invitation, new Date()) !== 'pending'
    ) {
      throw new UnprocessableEntityException(INVALID_OR_EXPIRED_LINK_MESSAGE);
    }

    // Requested through an invite link: that link must still be usable
    // (checked again, atomically, when counting the join below).
    if (invitation.inviteLinkId) {
      const link = await this.inviteLinks.findOne({
        where: {
          id: invitation.inviteLinkId,
          organisationId: invitation.organisationId,
        },
      });
      if (!link || computeInviteLinkStatus(link, new Date()) !== 'active') {
        throw new UnprocessableEntityException(INVITE_LINK_INACTIVE_MESSAGE);
      }
    }

    const existingUser = await this.users.findOne({
      where: { email: invitation.email },
    });

    let userId: string;
    let issueNewSession = false;

    if (existingUser?.passwordHash) {
      const authenticatedUserId = this.readAuthenticatedUserId(request);

      if (authenticatedUserId !== existingUser.id) {
        throw new ConflictException({
          code: 'ACCOUNT_EXISTS',
          message:
            'An account already exists for this email. Log in to accept this invitation.',
        });
      }

      userId = existingUser.id;
    } else {
      if (!dto.password) {
        throw new UnprocessableEntityException(
          'A password is required to accept this invitation.',
        );
      }

      if (!existingUser && (!dto.firstName || !dto.lastName)) {
        throw new UnprocessableEntityException(
          'Your first and last name are required to accept this invitation.',
        );
      }

      const passwordHash = await this.passwordService.hash(dto.password);

      userId = await this.dataSource.transaction(async (manager) => {
        if (existingUser) {
          await manager.update(User, existingUser.id, {
            passwordHash,
            emailVerifiedAt: new Date(),
          });
          return existingUser.id;
        }

        const created = await manager.save(
          manager.create(User, {
            email: invitation.email,
            name: `${dto.firstName} ${dto.lastName}`,
            firstName: dto.firstName,
            lastName: dto.lastName,
            passwordHash,
            emailVerifiedAt: new Date(),
          }),
        );
        return created.id;
      });
      issueNewSession = true;
    }

    await this.dataSource.transaction(async (manager) => {
      if (invitation.inviteLinkId) {
        // Conditional increment: two people accepting at once can't both
        // squeeze past the cap. No row updated means the link filled up
        // (or was switched off) in the meantime — undo the whole join.
        const counted = await manager
          .createQueryBuilder()
          .update(InviteLink)
          .set({ usageCount: () => '"usageCount" + 1' })
          .where('id = :id', { id: invitation.inviteLinkId })
          .andWhere('enabled = true')
          .andWhere('("expiresAt" IS NULL OR "expiresAt" > :now)', {
            now: new Date(),
          })
          .andWhere('("usageCap" IS NULL OR "usageCount" < "usageCap")')
          .execute();
        if (!counted.affected) {
          throw new UnprocessableEntityException(INVITE_LINK_INACTIVE_MESSAGE);
        }
      }

      const newMembership = await manager.save(
        manager.create(Membership, {
          userId,
          organisationId: invitation.organisationId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        }),
      );

      // Same rule as projects below: only teams still in this organisation.
      const teamIds = invitation.teamIds ?? [];
      const teams = teamIds.length
        ? await manager.find(Team, {
            where: {
              id: In(teamIds),
              organisationId: invitation.organisationId,
            },
          })
        : [];
      for (const team of teams) {
        await manager.save(
          manager.create(TeamMembership, {
            membershipId: newMembership.id,
            teamId: team.id,
            isManager: false,
          }),
        );
      }

      // Only projects still in this organisation and not archived — one
      // deleted or archived since the invite was sent is skipped silently.
      const projectIds = invitation.projectIds ?? [];
      const projects = projectIds.length
        ? await manager.find(Project, {
            where: {
              id: In(projectIds),
              organisationId: invitation.organisationId,
              archivedAt: IsNull(),
            },
          })
        : [];
      for (const project of projects) {
        await manager.save(
          manager.create(ProjectMembership, {
            projectId: project.id,
            membershipId: newMembership.id,
            role: ProjectMembershipRole.MEMBER,
          }),
        );
      }

      await manager.update(Invitation, invitation.id, {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      });

      await this.auditLogService.record(manager, {
        action: 'membership.joined',
        organisationId: invitation.organisationId,
        actorUserId: userId,
        metadata: { email: invitation.email, role: invitation.role },
      });
    });

    recordAnalyticsEvent('invite_accepted', {
      userId,
      organisationId: invitation.organisationId,
    });

    if (issueNewSession) {
      const accessToken = this.tokenService.signAccessToken(userId);
      const refreshToken = await this.refreshTokenService.issue(
        this.dataSource.manager,
        userId,
      );
      setSessionCookies(
        response,
        accessToken,
        refreshToken,
        this.configService,
      );
    }

    // A new Membership puts someone on the bill. After the transaction, so a
    // failed sync can never undo the acceptance itself.
    await this.billedSeatsService.syncToProvider(invitation.organisationId);

    return { message: `Welcome to ${invitation.organisation.name}.` };
  }

  private async upsertInvitation(
    organisation: Organisation,
    actorUserId: string,
    entry: CreateInvitationEntryDto,
  ): Promise<InvitationEntryResult> {
    const email = entry.email.trim().toLowerCase();

    if (!isEmail(email)) {
      return { email, outcome: 'invalid', message: 'Invalid email format.' };
    }

    const activeMember = await this.findActiveMemberByEmail(
      organisation.id,
      email,
    );

    if (activeMember) {
      return {
        email,
        outcome: 'already_member',
        message: 'This person is already a member of this organisation.',
      };
    }

    const teamIds = [...new Set(entry.teamIds ?? [])];
    if (teamIds.length > 0) {
      const teamCount = await this.teams.count({
        where: { id: In(teamIds), organisationId: organisation.id },
      });
      if (teamCount !== teamIds.length) {
        return {
          email,
          outcome: 'invalid',
          message: 'One or more teams were not found.',
        };
      }
    }

    const projectIds = [...new Set(entry.projectIds ?? [])];
    if (projectIds.length > 0) {
      const projectCount = await this.projects.count({
        where: {
          id: In(projectIds),
          organisationId: organisation.id,
          archivedAt: IsNull(),
        },
      });
      if (projectCount !== projectIds.length) {
        return {
          email,
          outcome: 'invalid',
          message: 'One or more projects were not found or are archived.',
        };
      }
    }

    const existingInvitation = await this.invitations.findOne({
      where: {
        organisationId: organisation.id,
        email,
        status: InvitationStatus.PENDING,
      },
    });

    return this.stampAndSendToken(
      organisation,
      existingInvitation?.id ?? null,
      email,
      entry.role,
      teamIds,
      projectIds,
      actorUserId,
      // An admin/manager inviting directly takes over from any link.
      { inviteLinkId: null },
    );
  }

  /**
   * The invite-link join path (see InviteLinksService.requestJoin): sends an
   * ordinary invitation carrying the link's role, teams and projects as
   * they are right now. Never reveals anything to the anonymous caller —
   * it silently does nothing when the email is invalid, already a member,
   * or already has a live invitation from somewhere else (a public request
   * must never rewrite an invite an admin sent). A repeat request through
   * the same link resends at most once per RESEND_COOLDOWN_MS.
   */
  async requestViaInviteLink(
    link: InviteLink,
    rawEmail: string,
  ): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!isEmail(email)) return;

    if (await this.findActiveMemberByEmail(link.organisationId, email)) return;

    const pending = await this.invitations.findOne({
      where: {
        organisationId: link.organisationId,
        email,
        status: InvitationStatus.PENDING,
      },
    });
    const now = new Date();
    const pendingIsLive =
      pending !== null &&
      computeEffectiveInvitationStatus(pending, now) === 'pending';

    if (pending && pendingIsLive && pending.inviteLinkId !== link.id) return;
    if (
      pending &&
      pendingIsLive &&
      this.sentWithin(pending, RESEND_COOLDOWN_MS, now)
    ) {
      return;
    }

    const organisation = await this.organisations.findOneOrFail({
      where: { id: link.organisationId },
    });
    await this.stampAndSendToken(
      organisation,
      pending?.id ?? null,
      email,
      link.role,
      link.teamIds,
      link.projectIds,
      link.createdByUserId,
      { inviteLinkId: link.id, auditAction: 'invitation.requested_via_link' },
    );
  }

  /** Invitations don't store when they were sent, but every send stamps
   * `expiresAt` a fixed TTL ahead — so the send time is recoverable. */
  private sentWithin(
    invitation: Invitation,
    windowMs: number,
    now: Date,
  ): boolean {
    if (!invitation.expiresAt) return false;
    const sentAt = invitation.expiresAt.getTime() - this.invitationTtlMs();
    return now.getTime() - sentAt < windowMs;
  }

  private invitationTtlMs(): number {
    return (
      Number(
        this.configService.get(
          'INVITATION_TTL_HOURS',
          DEFAULT_INVITATION_TTL_HOURS,
        ),
      ) * MS_PER_HOUR
    );
  }

  private async findActiveMemberByEmail(
    organisationId: string,
    email: string,
  ): Promise<Membership | null> {
    return this.memberships
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .where('membership.organisationId = :organisationId', {
        organisationId,
      })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.ACTIVE,
      })
      .andWhere('user.email = :email', { email })
      .getOne();
  }

  /**
   * Generates a fresh token, stamps it (and pending status/expiry) onto
   * `invitationId` if given, or creates a new row otherwise, then emails it.
   * The single place both a brand-new invite and a resend of any existing
   * one (whatever its prior status) go through.
   */
  private async stampAndSendToken(
    organisation: Organisation,
    invitationId: string | null,
    email: string,
    role: MembershipRole,
    teamIds: string[],
    projectIds: string[],
    actorUserId: string | null,
    options: {
      /** Which invite link this came through — `null` for an email invite
       * (clearing any link a reused row had), omitted to leave it as is. */
      inviteLinkId?: string | null;
      auditAction?: string;
    } = {},
  ): Promise<InvitationEntryResult> {
    const isResend = invitationId !== null;
    const linkFields =
      options.inviteLinkId === undefined
        ? {}
        : { inviteLinkId: options.inviteLinkId };
    const token = this.tokenService.generateToken();
    const expiresAt = new Date(Date.now() + this.invitationTtlMs());
    const tokenHash = hashToken(token);

    await this.dataSource.transaction(async (manager) => {
      if (invitationId) {
        await manager.update(Invitation, invitationId, {
          role,
          teamIds,
          projectIds,
          status: InvitationStatus.PENDING,
          tokenHash,
          expiresAt,
          invitedByUserId: actorUserId,
          ...linkFields,
        });
      } else {
        await manager.save(
          manager.create(Invitation, {
            email,
            role,
            teamIds,
            projectIds,
            organisationId: organisation.id,
            tokenHash,
            expiresAt,
            invitedByUserId: actorUserId,
            status: InvitationStatus.PENDING,
            ...linkFields,
          }),
        );
      }

      await this.auditLogService.record(manager, {
        action:
          options.auditAction ??
          (isResend ? 'invitation.resent' : 'invitation.created'),
        organisationId: organisation.id,
        actorUserId,
        metadata: { email, role, inviteLinkId: options.inviteLinkId },
      });
    });

    await this.emailService.sendInvitationEmail(
      email,
      token,
      organisation.name,
    );

    recordAnalyticsEvent('invite_sent', {
      organisationId: organisation.id,
      resend: isResend,
    });

    return { email, outcome: isResend ? 'resent' : 'sent' };
  }

  private readAuthenticatedUserId(request: Request): string | null {
    const token = readCookie(request, ACCESS_TOKEN_COOKIE);

    if (!token) {
      return null;
    }

    try {
      return this.jwtService.verify<{ sub: string }>(token).sub;
    } catch {
      return null;
    }
  }
}
