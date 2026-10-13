import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { canViewMembership } from '../../common/membership-visibility.util';
import { findEntryCovering } from '../../common/time-entry-coverage.util';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { AppEventItemDto } from '../dto/app-event-item.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Every sample is treated as representing this many seconds of foreground
 * time — an approximation (not a measured duration), matching the desktop
 * agent's own default sampling interval
 * (desktop/src/main/window-sampler.ts's DEFAULT_WINDOW_SAMPLE_INTERVAL_MS).
 * Good enough for a first cut per docs/adr/0010-...; a gap-based
 * calculation (time between consecutive samples) would be more precise if
 * the interval ever becomes configurable per-org.
 */
export const SAMPLE_INTERVAL_SECONDS = 5;

export interface AppHourBucketItem {
  /** The project whose TimeEntry covered these samples — null means no
   * timer was running (the common case: the desktop agent samples
   * continuously, a TimeEntry only exists while a timer runs). */
  projectId: string | null;
  appName: string;
  secondsSpent: number;
  /**
   * A "session" is a maximal run of consecutive samples of this app in
   * `sampledAt` order, ending the moment a *different* app becomes the
   * foreground sample — not a time-gap threshold (a gap threshold would
   * over-count sessions from ordinary dropped sampling ticks). A session's
   * duration is split across whichever hour(s)/project(s) its samples
   * actually fall in (so subtotals sum to the day total); its count is
   * attributed once, to the hour/project bucket of its *first* sample.
   */
  sessionCount: number;
}

export interface AppHourBucket {
  /** ISO instant for the start of this hour. */
  hourStart: string;
  items: AppHourBucketItem[];
}

export interface AppActivityDay {
  date: string;
  totalSecondsSpent: number;
  /** Only hours with at least one (post-filter) sample — a tracked day
   * rarely fills 24 contiguous hours, so empty hour headers are omitted. */
  buckets: AppHourBucket[];
}

interface AppActivityFilter {
  /** undefined = every project; a string = that project only. Samples no
   * TimeEntry covers are never returned regardless. */
  projectId?: string;
}

@Injectable()
export class AppEventsService {
  constructor(
    @InjectRepository(AppEvent)
    private readonly appEvents: Repository<AppEvent>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  /**
   * Authorization (is the caller a logged-in device) is enforced upstream
   * by DeviceSessionGuard — reaching this method already implies a valid
   * device session for this organisation.
   */
  async recordBatch(
    organisationId: string,
    userId: string,
    deviceId: string,
    events: AppEventItemDto[],
  ): Promise<void> {
    const membership = await this.getActiveMembership(organisationId, userId);

    // Dropped silently rather than rejected: an agent that ignored the
    // setting has nothing to fix by retrying.
    const captureSettings = await this.organisationsService.getCaptureSettings(
      organisationId,
      userId,
    );
    if (captureSettings.appUrlTracking === 'off') {
      return;
    }
    const keepTitles = captureSettings.windowTrackingEnabled;

    const rows = events.map((event) =>
      this.appEvents.create({
        organisationId,
        membershipId: membership.id,
        deviceId,
        appName: event.appName,
        title: keepTitles ? (event.title ?? null) : null,
        titleUnavailableReason: event.titleUnavailableReason ?? null,
        sampledAt: new Date(event.sampledAt),
      }),
    );

    await this.appEvents.save(rows);
  }

  async getMyDay(
    organisationId: string,
    userId: string,
    date: string | undefined,
    filter: AppActivityFilter = {},
  ): Promise<AppActivityDay> {
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.buildDayForMembershipId(
      organisationId,
      membership.id,
      this.resolveDate(date),
      filter,
    );
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or a manager for
   * their own team — peers never see each other's app activity. See
   * canViewMembership for the shared rule (same as Activities/TimeEntries).
   */
  async getDayForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
    date: string | undefined,
    filter: AppActivityFilter = {},
  ): Promise<AppActivityDay> {
    const [caller, target] = await Promise.all([
      this.memberships.findOne({
        where: {
          userId: callerUserId,
          organisationId,
          status: MembershipStatus.ACTIVE,
        },
        relations: { teamMemberships: true },
      }),
      this.memberships.findOne({
        where: { id: targetMembershipId, organisationId },
        relations: { teamMemberships: true },
      }),
    ]);

    if (!caller || !target) {
      throw new NotFoundException('Membership not found.');
    }

    if (!canViewMembership(caller, target)) {
      throw new ForbiddenException(
        "You cannot view this member's app activity.",
      );
    }

    return this.buildDayForMembershipId(
      organisationId,
      target.id,
      this.resolveDate(date),
      filter,
    );
  }

  private async buildDayForMembershipId(
    organisationId: string,
    membershipId: string,
    date: string,
    filter: AppActivityFilter,
  ): Promise<AppActivityDay> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + MS_PER_DAY);

    const [rows, coveringEntries] = await Promise.all([
      this.appEvents.find({
        where: {
          organisationId,
          membershipId,
          sampledAt: Between(start, end),
        },
        order: { sampledAt: 'ASC' },
      }),
      this.timeEntriesService.listCoveringWindow(
        organisationId,
        membershipId,
        start,
        end,
      ),
    ]);

    // Keyed by `${hourStart}|${projectId ?? 'untracked'}|${appName}` — one
    // row per (hour, project, app) combination, matching the response's
    // per-bucket `items` shape.
    const cells = new Map<string, AppHourBucketItem & { hourStart: string }>();
    let previousAppName: string | null = null;

    for (const row of rows) {
      const projectId =
        findEntryCovering(coveringEntries, row.sampledAt)?.projectId ?? null;
      // Samples no Time entry covers are hidden, not deleted: the capture
      // happened, but without an entry behind it there is nothing to
      // attribute it to. Shorten an entry and its samples drop out of view;
      // put the time back and they return, because coverage is recomputed on
      // every read.
      if (projectId === null) {
        // Reset the session run too — the covered samples either side of a
        // hidden stretch aren't one continuous session.
        previousAppName = null;
        continue;
      }
      const hourStart = new Date(
        Math.floor(row.sampledAt.getTime() / MS_PER_HOUR) * MS_PER_HOUR,
      ).toISOString();
      const key = `${hourStart}|${projectId ?? 'untracked'}|${row.appName}`;

      let cell = cells.get(key);
      if (!cell) {
        cell = {
          hourStart,
          projectId,
          appName: row.appName,
          secondsSpent: 0,
          sessionCount: 0,
        };
        cells.set(key, cell);
      }
      cell.secondsSpent += SAMPLE_INTERVAL_SECONDS;

      const isNewSession = row.appName !== previousAppName;
      if (isNewSession) {
        cell.sessionCount += 1;
      }
      previousAppName = row.appName;
    }

    const matchesFilter = (projectId: string | null): boolean => {
      if (filter.projectId === undefined) return true;
      return filter.projectId === projectId;
    };

    const bucketsByHour = new Map<string, AppHourBucketItem[]>();
    let totalSecondsSpent = 0;
    for (const cell of cells.values()) {
      if (!matchesFilter(cell.projectId)) continue;
      totalSecondsSpent += cell.secondsSpent;
      const { hourStart, ...item } = cell;
      const items = bucketsByHour.get(hourStart) ?? [];
      items.push(item);
      bucketsByHour.set(hourStart, items);
    }

    const buckets = Array.from(bucketsByHour.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hourStart, items]) => ({
        hourStart,
        items: items.sort((a, b) => b.secondsSpent - a.secondsSpent),
      }));

    return { date, totalSecondsSpent, buckets };
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
