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
import { DataSource, Repository } from 'typeorm';
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
import { Invitation } from '../../database/entities/invitation.entity';
import { InvitationStatus } from '../../database/entities/invitation-status.enum';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { User } from '../../database/entities/user.entity';
import { EmailService } from '../../email/services/email.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { CreateInvitationEntryDto } from '../dto/create-invitation-entry.dto';
import {
  computeEffectiveInvitationStatus,
  EffectiveInvitationStatus,
} from '../effective-invitation-status.util';

const DEFAULT_INVITATION_TTL_HOURS = 72;
const MS_PER_HOUR = 60 * 60 * 1000;
const INVALID_OR_EXPIRED_LINK_MESSAGE = 'This link is invalid or has expired.';

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
  teamId: string | null;
  status: EffectiveInvitationStatus;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface InvitationPreview {
  status: EffectiveInvitationStatus | 'not_found';
  email?: string;
  organisationName?: string;
  role?: MembershipRole;
  teamName?: string | null;
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
  ) {}

  async createMany(
    organisationId: string,
    actorUserId: string,
    entries: CreateInvitationEntryDto[],
  ): Promise<InvitationEntryResult[]> {
    const organisation = await this.organisations.findOneOrFail({
      where: { id: organisationId },
    });

    const results: InvitationEntryResult[] = [];

    for (const entry of entries) {
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
      invitation.teamId,
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

    const now = new Date();

    return invitations
      .filter((invitation) => invitation.status !== InvitationStatus.ACCEPTED)
      .map((invitation) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        teamId: invitation.teamId,
        status: computeEffectiveInvitationStatus(invitation, now),
        createdAt: invitation.createdAt,
        expiresAt: invitation.expiresAt,
      }));
  }

  async getPreview(token: string): Promise<InvitationPreview> {
    const invitation = await this.invitations.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { organisation: true, team: true },
    });

    if (!invitation) {
      return { status: 'not_found' };
    }

    const status = computeEffectiveInvitationStatus(invitation, new Date());
    const invitedUser = await this.users.findOne({
      where: { email: invitation.email },
    });

    return {
      status,
      email: invitation.email,
      organisationName: invitation.organisation.name,
      role: invitation.role,
      teamName: invitation.team?.name ?? null,
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
      computeEffectiveInvitationStatus(invitation, new Date()) !== 'pending'
    ) {
      throw new UnprocessableEntityException(INVALID_OR_EXPIRED_LINK_MESSAGE);
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
      const newMembership = await manager.save(
        manager.create(Membership, {
          userId,
          organisationId: invitation.organisationId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
        }),
      );

      if (invitation.teamId) {
        await manager.save(
          manager.create(TeamMembership, {
            membershipId: newMembership.id,
            teamId: invitation.teamId,
            isManager: false,
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
      entry.teamId ?? null,
      actorUserId,
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
    teamId: string | null,
    actorUserId: string,
  ): Promise<InvitationEntryResult> {
    const isResend = invitationId !== null;
    const token = this.tokenService.generateToken();
    const ttlHours = Number(
      this.configService.get(
        'INVITATION_TTL_HOURS',
        DEFAULT_INVITATION_TTL_HOURS,
      ),
    );
    const expiresAt = new Date(Date.now() + ttlHours * MS_PER_HOUR);
    const tokenHash = hashToken(token);

    await this.dataSource.transaction(async (manager) => {
      if (invitationId) {
        await manager.update(Invitation, invitationId, {
          role,
          teamId,
          status: InvitationStatus.PENDING,
          tokenHash,
          expiresAt,
          invitedByUserId: actorUserId,
        });
      } else {
        await manager.save(
          manager.create(Invitation, {
            email,
            role,
            teamId,
            organisationId: organisation.id,
            tokenHash,
            expiresAt,
            invitedByUserId: actorUserId,
            status: InvitationStatus.PENDING,
          }),
        );
      }

      await this.auditLogService.record(manager, {
        action: isResend ? 'invitation.resent' : 'invitation.created',
        organisationId: organisation.id,
        actorUserId,
        metadata: { email, role },
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
