import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { UrlSession } from '../../database/entities/url-session.entity';
import { UrlSessionEntryDto } from '../dto/url-session-entry.dto';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

// A personal "sites visited" view, not a report — mirrors
// TimeEntriesService's own LIST_LIMIT precedent. Revisit with real
// pagination/query-time aggregation if this becomes a heavy, long-lived
// view (a manager scanning months of history for one person).
const RAW_SESSION_LIMIT = 1000;

export interface SyncResult {
  acked: string[];
}

export interface UrlSessionGroup {
  url: string;
  host: string;
  /** From whichever session for this URL ended most recently. */
  title: string | null;
  /** Summed `activeMs` across every session for this URL. */
  totalActiveMs: number;
  lastVisitedAt: Date;
  sessionCount: number;
}

@Injectable()
export class UrlSessionsService {
  constructor(
    @InjectRepository(UrlSession)
    private readonly urlSessions: Repository<UrlSession>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Ingests a batch from the desktop agent's sync queue — see
   * docs/url-tracking-api.md for the full contract. `id` is the client's
   * idempotency key: upserting by it (rather than inserting once) is what
   * lets the same session re-sync with a larger `activeMs`/later `endedAt`
   * after the engine's merge window reopens it, and lets a retried batch
   * (after a crash between persist and local ack) land as a no-op.
   *
   * `deviceId` always comes from the caller's authenticated device
   * session, never from the DTO — a session's own `deviceId` field exists
   * for the client's local bookkeeping, not as something this endpoint
   * trusts for attribution.
   *
   * Deliberately NOT clamping each session's range to a matching running
   * TimeEntry window yet — docs/url-tracking-api.md flags that join as an
   * explicit open decision ("needs a decision from the backend team
   * before reporting queries are built against it"), not a settled part
   * of the contract. Stored as received for now; revisit once a reporting
   * query actually needs the join.
   */
  async sync(
    organisationId: string,
    userId: string,
    authenticatedDeviceId: string,
    sessions: UrlSessionEntryDto[],
  ): Promise<SyncResult> {
    const membership = await this.getActiveMembership(organisationId, userId);

    // Plain objects, not `.create()` instances — `.upsert()` wants
    // `QueryDeepPartialEntity`, which the full `UrlSession` class (with its
    // `organisation`/`membership`/`device` relation properties) doesn't
    // structurally satisfy.
    const rows = sessions.map((session) => ({
      id: session.id,
      organisationId,
      membershipId: membership.id,
      deviceId: authenticatedDeviceId,
      url: session.url,
      host: session.host,
      path: session.path ?? null,
      title: session.title ?? null,
      browser: session.browser,
      private: session.private ?? null,
      startedAt: new Date(session.startedAt),
      endedAt: new Date(session.endedAt),
      activeMs: session.activeMs,
      tzOffsetMin: session.tzOffsetMin,
      source: session.source,
      confidence: session.confidence,
    }));

    await this.urlSessions.upsert(rows, ['id']);
    return { acked: rows.map((row) => row.id) };
  }

  /**
   * The caller's own tracked URLs (default) or, for an admin/manager,
   * another `targetMembershipId`'s — grouped by exact URL, most recently
   * visited first, with a summed `totalActiveMs` per URL. Private-session
   * rows (url stripped to `''` on the client — see UrlSession's own doc
   * comment) are excluded; there is nothing meaningful to display for one.
   */
  async listGroupedByUrl(
    organisationId: string,
    userId: string,
    targetMembershipId?: string,
  ): Promise<UrlSessionGroup[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const subjectMembershipId = await this.resolveSubjectMembershipId(
      organisationId,
      membership,
      targetMembershipId,
    );

    const rows = await this.urlSessions.find({
      where: { membershipId: subjectMembershipId, url: Not('') },
      order: { endedAt: 'DESC' },
      take: RAW_SESSION_LIMIT,
    });

    const byUrl = new Map<string, UrlSessionGroup>();
    for (const row of rows) {
      const existing = byUrl.get(row.url);
      if (existing) {
        existing.totalActiveMs += row.activeMs;
        existing.sessionCount += 1;
        // Rows are already ordered by endedAt DESC, so the first row seen
        // per url is the most recent — never overwrite title/lastVisitedAt
        // from an older one.
        continue;
      }
      byUrl.set(row.url, {
        url: row.url,
        host: row.host,
        title: row.title,
        totalActiveMs: row.activeMs,
        lastVisitedAt: row.endedAt,
        sessionCount: 1,
      });
    }

    return Array.from(byUrl.values()).sort(
      (a, b) => b.lastVisitedAt.getTime() - a.lastVisitedAt.getTime(),
    );
  }

  /**
   * Deletes every tracked session for one URL, for one member — the
   * member-detail page's per-row delete action. Admin/manager only (see
   * `@RequireRole` on the controller route); logged since this permanently
   * removes another person's tracked browsing history.
   */
  async deleteByUrl(
    organisationId: string,
    userId: string,
    targetMembershipId: string,
    url: string,
  ): Promise<void> {
    if (!targetMembershipId || !url) {
      throw new BadRequestException('membershipId and url are required.');
    }

    const target = await this.memberships.findOne({
      where: { id: targetMembershipId, organisationId },
    });
    if (!target) {
      throw new NotFoundException('Member not found.');
    }

    const result = await this.urlSessions.delete({
      organisationId,
      membershipId: target.id,
      url,
    });

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'url_session.deleted_by_url',
        organisationId,
        actorUserId: userId,
        metadata: {
          membershipId: target.id,
          url,
          deletedCount: result.affected ?? 0,
        },
      });
    });
  }

  private async resolveSubjectMembershipId(
    organisationId: string,
    callerMembership: Membership,
    targetMembershipId?: string,
  ): Promise<string> {
    if (!targetMembershipId || targetMembershipId === callerMembership.id) {
      return callerMembership.id;
    }
    if (!ORG_WIDE_ROLES.includes(callerMembership.role)) {
      throw new ForbiddenException(
        "Only an admin or manager can view another member's website activity.",
      );
    }
    const target = await this.memberships.findOne({
      where: { id: targetMembershipId, organisationId },
    });
    if (!target) {
      throw new NotFoundException('Member not found.');
    }
    return target.id;
  }

  private async getActiveMembership(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }
    return membership;
  }
}
