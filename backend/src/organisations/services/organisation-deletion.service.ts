import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { hashToken } from '../../common/hash-token.util';
import { DeviceSession } from '../../database/entities/device-session.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Organisation } from '../../database/entities/organisation.entity';
import {
  OrganisationDeletionMode,
  OrganisationDeletionRequest,
} from '../../database/entities/organisation-deletion-request.entity';
import { User } from '../../database/entities/user.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { EmailService } from '../../email/services/email.service';
import { RequestOrganisationDeletionDto } from '../dto/request-organisation-deletion.dto';
import { OrganisationPurgeService } from './organisation-purge.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRACE_DAYS = 30;
const DEFAULT_CONFIRMATION_TTL_HOURS = 24;

export type OrganisationDeletionState =
  'active' | 'scheduled' | 'suspended' | 'purging';

export interface OrganisationDeletionStatus {
  state: OrganisationDeletionState;
  deletionScheduledFor: string | null;
  suspendedAt: string | null;
  purgeAt: string | null;
  graceDays: number;
  isOwner: boolean;
  /** What deleting would remove — shown in the confirmation dialog. */
  impact: {
    people: number;
    projects: number;
    trackedSeconds: number;
    devices: number;
  };
  /** Where the confirmation link will be sent. */
  ownerEmail: string | null;
  /**
   * Whether the owner's own User survives the purge (they belong to another
   * Organisation). Null for anyone but the owner.
   */
  ownerKeepsAccount: boolean | null;
  /**
   * The mode of the request awaiting its emailed confirmation, so the
   * confirm step can say whether it's irreversible. Null for anyone but the
   * owner, or when nothing is pending.
   */
  pendingRequestMode: OrganisationDeletionMode | null;
}

export interface OrganisationDeletionConfirmation {
  message: string;
  /** True when the caller's own account is about to be erased by the purge. */
  signedOut: boolean;
}

/**
 * Lifecycle of an owner-initiated account deletion — see
 * docs/adr/0021-organisation-deletion-soft-then-hard.md and
 * docs/adr/0023-owner-can-opt-into-immediate-purge.md. `active` →
 * (`scheduled` →) `suspended` → `purging` → purged; the owner can return to
 * `active` from `scheduled` or `suspended`, but not once `purgeAt` is reached.
 */
@Injectable()
export class OrganisationDeletionService {
  private readonly logger = new Logger(OrganisationDeletionService.name);
  private readonly graceDays: number;
  private readonly confirmationTtlHours: number;
  /** Purges started by this process, so the cron and a confirm never overlap. */
  private readonly purgesInFlight = new Set<string>();

  constructor(
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(OrganisationDeletionRequest)
    private readonly requests: Repository<OrganisationDeletionRequest>,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly purgeService: OrganisationPurgeService,
    configService: ConfigService,
  ) {
    this.graceDays = Number(
      configService.get<string>(
        'ORGANISATION_DELETION_GRACE_DAYS',
        String(DEFAULT_GRACE_DAYS),
      ),
    );
    this.confirmationTtlHours = Number(
      configService.get<string>(
        'ORGANISATION_DELETION_CONFIRMATION_TTL_HOURS',
        String(DEFAULT_CONFIRMATION_TTL_HOURS),
      ),
    );
  }

  async getStatus(
    organisationId: string,
    userId: string,
  ): Promise<OrganisationDeletionStatus> {
    const organisation = await this.getOrganisation(organisationId);
    const owner = organisation.ownerUserId
      ? await this.users.findOne({ where: { id: organisation.ownerUserId } })
      : null;
    const isOwner = organisation.ownerUserId === userId;
    return {
      ...this.toStatus(organisation, userId),
      impact: await this.getImpact(organisationId),
      // Only the owner is told where the link goes; other admins don't need it.
      ownerEmail: isOwner ? (owner?.email ?? null) : null,
      ownerKeepsAccount: isOwner
        ? await this.belongsElsewhere(userId, organisationId)
        : null,
      pendingRequestMode: isOwner
        ? ((
            await this.requests.findOne({
              where: { organisationId, requestedByUserId: userId },
            })
          )?.mode ?? null)
        : null,
    };
  }

  private async getImpact(
    organisationId: string,
  ): Promise<OrganisationDeletionStatus['impact']> {
    const [row]: {
      people: number;
      projects: number;
      trackedSeconds: number;
      devices: number;
    }[] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM "memberships" WHERE "organisationId" = $1 AND "status" = 'active')::int AS "people",
         (SELECT COUNT(*) FROM "projects" WHERE "organisationId" = $1)::int AS "projects",
         (SELECT COUNT(*) FROM "devices" WHERE "organisationId" = $1)::int AS "devices",
         GREATEST(0, COALESCE((SELECT SUM(EXTRACT(EPOCH FROM ("endedAt" - "startedAt"))) FROM "time_entries" WHERE "organisationId" = $1 AND "endedAt" IS NOT NULL), 0)
           - COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (p."resumedAt" - p."pausedAt"))) FROM "time_entry_pauses" p WHERE p."organisationId" = $1 AND p."resumedAt" IS NOT NULL), 0))::int AS "trackedSeconds"`,
      [organisationId],
    );
    return row;
  }

  /**
   * Step 1: validates the request and emails the owner a confirmation link.
   * Nothing about the organisation changes until they open it.
   */
  async requestDeletion(
    organisationId: string,
    userId: string,
    dto: RequestOrganisationDeletionDto,
  ): Promise<{ message: string }> {
    const organisation = await this.getOwnedOrganisation(
      organisationId,
      userId,
    );
    this.assertCanRequest(organisation, dto.mode);

    if (dto.confirmName !== organisation.name) {
      throw new BadRequestException(
        'Type the organisation name exactly to confirm deletion.',
      );
    }

    let scheduledFor: Date | null = null;
    if (dto.mode === OrganisationDeletionMode.SCHEDULED) {
      scheduledFor = dto.scheduledFor ? new Date(dto.scheduledFor) : null;
      if (!scheduledFor || scheduledFor.getTime() <= Date.now()) {
        throw new BadRequestException(
          'Choose a scheduled deletion date in the future.',
        );
      }
    }

    const owner = await this.memberships.findOneOrFail({
      where: { userId, organisationId },
      relations: { user: true },
    });

    const token = randomBytes(32).toString('hex');
    await this.dataSource.transaction(async (manager) => {
      // Only the newest emailed link is ever valid.
      await manager.delete(OrganisationDeletionRequest, { organisationId });
      await manager.save(
        manager.create(OrganisationDeletionRequest, {
          organisationId,
          requestedByUserId: userId,
          tokenHash: hashToken(token),
          mode: dto.mode,
          scheduledFor,
          expiresAt: new Date(
            Date.now() + this.confirmationTtlHours * 60 * 60 * 1000,
          ),
        }),
      );
      await this.auditLogService.record(manager, {
        action: 'organisation.deletion_requested',
        organisationId,
        actorUserId: userId,
        metadata: {
          mode: dto.mode,
          scheduledFor: scheduledFor?.toISOString() ?? null,
        },
      });
    });

    await this.emailService.sendOrganisationDeletionConfirmationEmail(
      owner.user.email,
      token,
      organisation.publicId,
      organisation.name,
      dto.mode === OrganisationDeletionMode.PERMANENT
        ? 'permanently and immediately, with no recovery window. This cannot be undone'
        : scheduledFor
          ? `scheduled for ${scheduledFor.toUTCString()}`
          : `immediately, with a ${this.graceDays}-day recovery window`,
    );

    return {
      message: 'Check your email — confirm the link we sent to continue.',
    };
  }

  /** Step 2: the owner opened the emailed link; apply the request. */
  async confirmDeletion(
    organisationId: string,
    userId: string,
    token: string,
  ): Promise<OrganisationDeletionConfirmation> {
    const organisation = await this.getOwnedOrganisation(
      organisationId,
      userId,
    );

    const request = await this.requests.findOne({
      where: { organisationId, tokenHash: hashToken(token) },
    });
    if (
      !request ||
      request.requestedByUserId !== userId ||
      request.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'This confirmation link is invalid or has expired. Request deletion again.',
      );
    }
    this.assertCanRequest(organisation, request.mode);

    if (request.mode === OrganisationDeletionMode.PERMANENT) {
      return this.confirmPermanentDeletion(organisation, userId);
    }

    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(OrganisationDeletionRequest, { organisationId });
      if (request.mode === OrganisationDeletionMode.NOW) {
        await this.suspend(manager, organisation, now, userId);
      } else {
        await manager.update(Organisation, organisationId, {
          deletionScheduledFor: request.scheduledFor,
        });
        await this.auditLogService.record(manager, {
          action: 'organisation.deletion_scheduled',
          organisationId,
          actorUserId: userId,
          metadata: { scheduledFor: request.scheduledFor?.toISOString() },
        });
      }
    });

    await this.notifyEveryone(
      organisationId,
      organisation.name,
      request.mode === OrganisationDeletionMode.NOW
        ? {
            admin: `${organisation.name} was closed by its owner and is suspended. Its data will be permanently deleted in ${this.graceDays} days unless the owner restores it.`,
            member: `${organisation.name} was closed by its owner. You no longer have access and desktop tracking has stopped. Contact the owner if this is a mistake.`,
          }
        : {
            admin: `The owner has scheduled ${organisation.name} for deletion on ${request.scheduledFor?.toUTCString()}. Its data will be permanently deleted ${this.graceDays} days after that unless the owner cancels.`,
            member: `The owner has scheduled ${organisation.name} for deletion on ${request.scheduledFor?.toUTCString()}. You can keep using it until then.`,
          },
    );

    return {
      message:
        request.mode === OrganisationDeletionMode.NOW
          ? 'Organisation suspended. You can restore it during the recovery window.'
          : 'Deletion scheduled.',
      signedOut: false,
    };
  }

  /**
   * Suspends (unless already suspended) with `purgeAt` = now, then starts the
   * purge without waiting for it: Wasabi deletion can outlast a request, and
   * if it fails the hourly job retries it because `purgeAt` has passed. No
   * "restorable" notice goes out — the purge's completion email is the only
   * one. See ADR-0023.
   */
  private async confirmPermanentDeletion(
    organisation: Organisation,
    userId: string,
  ): Promise<OrganisationDeletionConfirmation> {
    const now = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(OrganisationDeletionRequest, {
        organisationId: organisation.id,
      });
      if (organisation.suspendedAt) {
        await manager.update(Organisation, organisation.id, { purgeAt: now });
        await this.auditLogService.record(manager, {
          action: 'organisation.purge_expedited',
          organisationId: organisation.id,
          actorUserId: userId,
          metadata: {
            purgeAt: now.toISOString(),
            previousPurgeAt: organisation.purgeAt?.toISOString() ?? null,
          },
        });
      } else {
        await this.suspend(manager, organisation, now, userId, now);
      }
    });

    // Only an active Membership elsewhere leaves them anywhere to go; a
    // deactivated one keeps their User alive but gives no working session.
    const signedOut = !(await this.belongsElsewhere(userId, organisation.id, {
      activeOnly: true,
    }));
    this.startPurge(organisation);

    return {
      message: 'Permanent deletion has started.',
      signedOut,
    };
  }

  /** Cancels a scheduled deletion or restores a suspended organisation. */
  async cancelDeletion(
    organisationId: string,
    userId: string,
  ): Promise<{ message: string }> {
    const organisation = await this.getOwnedOrganisation(
      organisationId,
      userId,
    );
    if (this.isPurging(organisation)) {
      throw new ConflictException(
        'Permanent deletion is already in progress and cannot be stopped.',
      );
    }
    const wasSuspended = organisation.suspendedAt !== null;

    if (!wasSuspended && organisation.deletionScheduledFor === null) {
      await this.requests.delete({ organisationId });
      return { message: 'No deletion was in progress.' };
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(OrganisationDeletionRequest, { organisationId });
      await manager.update(Organisation, organisationId, {
        deletionScheduledFor: null,
        suspendedAt: null,
        purgeAt: null,
      });
      await this.auditLogService.record(manager, {
        action: 'organisation.deletion_cancelled',
        organisationId,
        actorUserId: userId,
        metadata: { wasSuspended },
      });
    });

    return {
      message: wasSuspended
        ? 'Organisation restored. Desktop agents need to sign in again.'
        : 'Scheduled deletion cancelled.',
    };
  }

  /**
   * Hourly: suspend organisations whose scheduled date has arrived, then
   * purge those whose recovery window has closed. Each organisation is
   * handled independently so one failure never blocks the rest, and a failed
   * purge simply retries next hour.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processDueDeletions(): Promise<void> {
    const now = new Date();

    const dueForSuspension = await this.organisations.find({
      where: {
        deletionScheduledFor: LessThanOrEqual(now),
        suspendedAt: IsNull(),
      },
    });
    for (const organisation of dueForSuspension) {
      try {
        await this.dataSource.transaction((manager) =>
          this.suspend(manager, organisation, now, null),
        );
        await this.notifyEveryone(organisation.id, organisation.name, {
          admin: `${organisation.name} has reached its scheduled deletion date and is now suspended. Its data will be permanently deleted in ${this.graceDays} days unless the owner restores it.`,
          member: `${organisation.name} has reached its scheduled deletion date. You no longer have access and desktop tracking has stopped. Contact the owner if this is a mistake.`,
        });
      } catch (error) {
        this.logger.error(
          `Failed to suspend organisation ${organisation.publicId}: ${String(error)}`,
        );
      }
    }

    const duePurge = await this.organisations.find({
      where: { purgeAt: LessThanOrEqual(now) },
    });
    for (const organisation of duePurge) {
      try {
        await this.runPurge(organisation);
      } catch (error) {
        this.logger.error(
          `Failed to purge organisation ${organisation.publicId}: ${String(error)}`,
        );
      }
    }
  }

  /** Fire-and-forget: a failure is logged and left for the hourly retry. */
  private startPurge(organisation: Organisation): void {
    this.runPurge(organisation).catch((error) => {
      this.logger.error(
        `Failed to purge organisation ${organisation.publicId}, will retry hourly: ${String(error)}`,
      );
    });
  }

  private async runPurge(organisation: Organisation): Promise<void> {
    if (this.purgesInFlight.has(organisation.id)) return;
    this.purgesInFlight.add(organisation.id);
    try {
      await this.purgeService.purge(organisation);
    } finally {
      this.purgesInFlight.delete(organisation.id);
    }
  }

  /**
   * Cuts off access immediately: stamps the suspension, stops every running
   * timer (closing any open pause at the same instant) and revokes every
   * device session, which is what makes the desktop agents stop capturing and
   * sign out on their next call. Web access is refused by RoleGuard.
   * Subscription cancellation is deliberately absent — no billing exists yet.
   */
  private async suspend(
    manager: EntityManager,
    organisation: Organisation,
    now: Date,
    actorUserId: string | null,
    purgeAt: Date = new Date(now.getTime() + this.graceDays * DAY_MS),
  ): Promise<void> {
    await manager.update(Organisation, organisation.id, {
      suspendedAt: now,
      purgeAt,
      deletionScheduledFor: null,
    });
    await manager.update(
      TimeEntryPause,
      { organisationId: organisation.id, resumedAt: IsNull() },
      { resumedAt: now },
    );
    await manager.update(
      TimeEntry,
      { organisationId: organisation.id, endedAt: IsNull() },
      { endedAt: now },
    );
    await manager.update(
      DeviceSession,
      { organisationId: organisation.id, revokedAt: IsNull() },
      { revokedAt: now },
    );
    await this.auditLogService.record(manager, {
      action: 'organisation.suspended',
      organisationId: organisation.id,
      actorUserId,
      metadata: { purgeAt: purgeAt.toISOString() },
    });
  }

  /**
   * Tells everyone active in the organisation, with wording per audience:
   * admins get the recovery details, everyone else just what it means for
   * them. Members are locked out the moment a suspension lands, so waiting
   * for the purge to tell them would leave them guessing for weeks.
   */
  private async notifyEveryone(
    organisationId: string,
    organisationName: string,
    messages: { admin: string; member: string },
  ): Promise<void> {
    const members = await this.memberships.find({
      where: { organisationId, status: MembershipStatus.ACTIVE },
      relations: { user: true },
    });
    await Promise.all(
      members.map((member) =>
        this.emailService.sendOrganisationDeletionNotice(
          member.user.email,
          organisationName,
          member.role === MembershipRole.ADMIN
            ? messages.admin
            : messages.member,
        ),
      ),
    );
  }

  private async getOrganisation(organisationId: string): Promise<Organisation> {
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }
    return organisation;
  }

  private async getOwnedOrganisation(
    organisationId: string,
    userId: string,
  ): Promise<Organisation> {
    const organisation = await this.getOrganisation(organisationId);
    if (organisation.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the organisation owner can delete or restore the account.',
      );
    }
    return organisation;
  }

  /**
   * A permanent deletion may replace a schedule or end a suspension's
   * recovery window early; the other modes need nothing in progress. Nothing
   * is accepted once the organisation is purging.
   */
  private assertCanRequest(
    organisation: Organisation,
    mode: OrganisationDeletionMode,
  ): void {
    if (this.isPurging(organisation)) {
      throw new ConflictException('Permanent deletion is already in progress.');
    }
    if (mode === OrganisationDeletionMode.PERMANENT) return;
    if (organisation.suspendedAt || organisation.deletionScheduledFor) {
      throw new ConflictException(
        'Deletion is already scheduled or in progress. Cancel it first.',
      );
    }
  }

  /** The point of no return: from `purgeAt` on, nothing can stop the purge. */
  private isPurging(organisation: Organisation, now = new Date()): boolean {
    return (
      organisation.purgeAt !== null &&
      organisation.purgeAt.getTime() <= now.getTime()
    );
  }

  /**
   * Without `activeOnly` this mirrors the purge's own rule for which Users
   * survive it: any Membership elsewhere, even a deactivated one.
   */
  private async belongsElsewhere(
    userId: string,
    organisationId: string,
    { activeOnly = false }: { activeOnly?: boolean } = {},
  ): Promise<boolean> {
    const count = await this.memberships.count({
      where: {
        userId,
        organisationId: Not(organisationId),
        ...(activeOnly && { status: MembershipStatus.ACTIVE }),
      },
    });
    return count > 0;
  }

  private toStatus(
    organisation: Organisation,
    userId: string,
  ): Omit<
    OrganisationDeletionStatus,
    'impact' | 'ownerEmail' | 'ownerKeepsAccount' | 'pendingRequestMode'
  > {
    return {
      state: this.isPurging(organisation)
        ? 'purging'
        : organisation.suspendedAt
          ? 'suspended'
          : organisation.deletionScheduledFor
            ? 'scheduled'
            : 'active',
      deletionScheduledFor:
        organisation.deletionScheduledFor?.toISOString() ?? null,
      suspendedAt: organisation.suspendedAt?.toISOString() ?? null,
      purgeAt: organisation.purgeAt?.toISOString() ?? null,
      graceDays: this.graceDays,
      isOwner: organisation.ownerUserId === userId,
    };
  }
}
