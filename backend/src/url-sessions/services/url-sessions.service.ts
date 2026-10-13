import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Not, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { findEntryCovering } from '../../common/time-entry-coverage.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { UrlSession } from '../../database/entities/url-session.entity';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { UrlSessionEntryDto } from '../dto/url-session-entry.dto';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

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

export interface UrlHourBucketPage {
  /** The project whose TimeEntry covered this session's startedAt — null
   * means no timer was running (the common case). */
  projectId: string | null;
  url: string;
  host: string;
  title: string | null;
  /** Summed whole — a session's `activeMs` is never split across an hour
   * boundary (it isn't `endedAt - startedAt`, see UrlSession's own doc
   * comment, so there's no principled way to partition it; it's counted in
   * full in the hour its session started). */
  activeMs: number;
  sessionCount: number;
}

export interface UrlHourBucket {
  hourStart: string;
  pages: UrlHourBucketPage[];
}

export interface UrlActivityDay {
  date: string;
  totalActiveMs: number;
  buckets: UrlHourBucket[];
}

interface UrlActivityFilter {
  /** undefined = every project; a string = that project only. Sessions no
   * TimeEntry covers are never returned regardless. */
  projectId?: string;
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
    private readonly timeEntriesService: TimeEntriesService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  /**
   * Ingests a batch from the desktop agent's sync queue (see
   * docs/url-tracking-api.md). `id` is the client's idempotency key, so a
   * reopened session re-syncs with a larger activeMs and a retried batch is
   * a no-op. `deviceId` comes from the authenticated session, never the DTO.
   *
   * Sessions are stored as received, not clamped to a TimeEntry window —
   * that join is still an open decision in the API doc.
   */
  async sync(
    organisationId: string,
    userId: string,
    authenticatedDeviceId: string,
    sessions: UrlSessionEntryDto[],
  ): Promise<SyncResult> {
    const membership = await this.getActiveMembership(organisationId, userId);

    // Acked without being stored: an empty ack would leave the batch
    // pending on the device, retried forever.
    const { appUrlTracking } =
      await this.organisationsService.getCaptureSettings(
        organisationId,
        userId,
      );
    if (appUrlTracking !== 'apps_urls') {
      return { acked: sessions.map((session) => session.id) };
    }

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
      where: {
        organisationId,
        membershipId: subjectMembershipId,
        url: Not(''),
      },
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
   * One day's tracked URLs, grouped by hour and (real, `TimeEntry`-derived)
   * project, then by exact URL within each — the Activities page's
   * hour-bucketed view. Deliberately a separate method from
   * `listGroupedByUrl` rather than adding date-scoping to it: that method's
   * two other callers (the dashboard's recent-URLs preview, the member
   * detail page) depend on its current "most recent 1000 rows, no date
   * filter" behaviour.
   */
  async getDayGroupedByUrl(
    organisationId: string,
    userId: string,
    date: string | undefined,
    filter: UrlActivityFilter = {},
    targetMembershipId?: string,
  ): Promise<UrlActivityDay> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const subjectMembershipId = await this.resolveSubjectMembershipId(
      organisationId,
      membership,
      targetMembershipId,
    );
    const resolvedDate = this.resolveDate(date);
    const start = new Date(`${resolvedDate}T00:00:00.000Z`);
    const end = new Date(start.getTime() + MS_PER_DAY);

    const [rows, coveringEntries] = await Promise.all([
      this.urlSessions.find({
        where: {
          organisationId,
          membershipId: subjectMembershipId,
          url: Not(''),
          startedAt: Between(start, end),
        },
        order: { startedAt: 'ASC' },
      }),
      this.timeEntriesService.listCoveringWindow(
        organisationId,
        subjectMembershipId,
        start,
        end,
      ),
    ]);

    // Keyed by `${hourStart}|${projectId ?? 'untracked'}|${url}`.
    const cells = new Map<string, UrlHourBucketPage & { hourStart: string }>();
    for (const row of rows) {
      const projectId =
        findEntryCovering(coveringEntries, row.startedAt)?.projectId ?? null;
      // Hidden, not deleted, while no Time entry covers it — see
      // AppEventsService for the reasoning.
      if (projectId === null) continue;
      const hourStart = new Date(
        Math.floor(row.startedAt.getTime() / MS_PER_HOUR) * MS_PER_HOUR,
      ).toISOString();
      const key = `${hourStart}|${projectId ?? 'untracked'}|${row.url}`;

      const existing = cells.get(key);
      if (existing) {
        existing.activeMs += row.activeMs;
        existing.sessionCount += 1;
        existing.title = row.title ?? existing.title;
        continue;
      }
      cells.set(key, {
        hourStart,
        projectId,
        url: row.url,
        host: row.host,
        title: row.title,
        activeMs: row.activeMs,
        sessionCount: 1,
      });
    }

    const matchesFilter = (projectId: string | null): boolean => {
      if (filter.projectId === undefined) return true;
      return filter.projectId === projectId;
    };

    const bucketsByHour = new Map<string, UrlHourBucketPage[]>();
    let totalActiveMs = 0;
    for (const cell of cells.values()) {
      if (!matchesFilter(cell.projectId)) continue;
      totalActiveMs += cell.activeMs;
      const { hourStart, ...page } = cell;
      const pages = bucketsByHour.get(hourStart) ?? [];
      pages.push(page);
      bucketsByHour.set(hourStart, pages);
    }

    const buckets = Array.from(bucketsByHour.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hourStart, pages]) => ({
        hourStart,
        pages: pages.sort((a, b) => b.activeMs - a.activeMs),
      }));

    return { date: resolvedDate, totalActiveMs, buckets };
  }

  /**
   * Deletes every tracked session for one URL, for one member. Admin/manager
   * only, and logged, since it permanently removes another person's history.
   *
   * Nobody may delete their OWN tracked activity, whatever their role —
   * stricter than ADR-0007's Time entry rule, because a Time entry is a
   * claim the person makes while tracked browsing is evidence about them.
   * Erasing your own record is a retention policy, not a per-row button.
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

    const caller = await this.getActiveMembership(organisationId, userId);
    if (caller.id === target.id) {
      throw new ForbiddenException(
        'You cannot delete your own tracked website activity.',
      );
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

  private resolveDate(date?: string): string {
    if (date === undefined) {
      return new Date().toISOString().slice(0, 10);
    }
    if (!DATE_PATTERN.test(date)) {
      throw new BadRequestException('date must be formatted as YYYY-MM-DD.');
    }
    return date;
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
