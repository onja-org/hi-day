import {
  InputCounts,
  inputCountsIn,
  sumInputCounts,
} from '../../common/input-counts.util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, In, Repository } from 'typeorm';
import {
  activityDayIn,
  type ActivityDay,
} from '../../common/activity-day.util';
import { canViewMembership } from '../../common/membership-visibility.util';
import { findEntryCovering } from '../../common/time-entry-coverage.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Screenshot } from '../../database/entities/screenshot.entity';
import {
  activityIn,
  dominantProjectIn,
  slotsBetween,
  weightedAverage,
  workedSecondsIn,
} from '../screenshot-slots.util';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import {
  MAX_DELETE_BATCH_SIZE,
  ScreenshotStorageService,
} from './screenshot-storage.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Expired rows read per batch of a retention run: as many as one storage
 * `DeleteObjects` call takes, so each batch is one request to the store.
 */
const RETENTION_CLEANUP_BATCH_SIZE = MAX_DELETE_BATCH_SIZE;

/**
 * How long one hourly retention run may keep deleting. Well inside the
 * hour, so runs never overlap; at a batch every second or two it clears
 * hundreds of thousands of screenshots, far beyond what a day adds.
 */
const RETENTION_CLEANUP_TIME_BUDGET_MS = 15 * 60 * 1000;

/**
 * The agent caps captures per ten minutes, but per **Device** — a person
 * signed in on two machines contributes both. Nine covers three Devices at
 * the fastest cadence the settings offer; the bound only stops an API-set
 * 30-second frequency filling a cell.
 */
export const MAX_SLOT_SCREENSHOTS = 9;

/** Four hours is twenty-four slots — the same order of images as a few
 * pages of the gallery beside it. */
export const DEFAULT_SLOT_HOURS_PAGE_SIZE = 4;
/** Every hour on a page costs its slots' presigned URLs and image loads. */
export const MAX_SLOT_HOURS_PAGE_SIZE = 12;

export interface ScreenshotSummaryItem {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — never a permanent/public link. */
  url: string;
  /** The project whose TimeEntry covered `capturedAt` — null if no timer
   * was running (the common case; see time-entry-coverage.util.ts). */
  projectId: string | null;
}

/** One 10-minute slot of a day, in the Screenshots page's 10-minute view. */
export interface ScreenshotSlot {
  /** Half-open [start, end) — the last slot of a DST-shortened day is shorter. */
  start: string;
  end: string;
  /** The Project most of the slot's tracked time went to; null when none was. */
  projectId: string | null;
  /** Seconds worked inside the slot, shared stretches counted once. */
  workedSeconds: number;
  /** 0-100, or null when nothing was measured — never 0 for "no data". */
  activePercentage: number | null;
  /** How much of the slot an activity sample covers, for the day's average. */
  activityMeasuredSeconds: number;
  /** Keystrokes, clicks and pointer travel in the slot; null when nothing
   * in it could be counted — "not available", never 0. */
  inputCounts: InputCounts | null;
  /** Every screenshot in the slot, up to `MAX_SLOT_SCREENSHOTS`. */
  screenshots: ScreenshotSummaryItem[];
  /** Anything past the bound. A count, not an expander. */
  extraCount: number;
}

export interface ScreenshotSlotHour {
  /** The hour's own start, on the organisation's calendar. */
  start: string;
  /** Seconds worked across the hour — the union, not the slots summed. */
  workedSeconds: number;
  slots: ScreenshotSlot[];
}

export interface ScreenshotSlotsDay {
  /** This page's hours only — see `totalHours`. */
  hours: ScreenshotSlotHour[];
  /** 1-based. Past the last page serves the last page instead, like the gallery. */
  page: number;
  pageSize: number;
  /** Hours with tracked time across the day. Empty ones are dropped before
   * paging, so no page is ever blank. */
  totalHours: number;
  /** The **whole day's** worked seconds, not this page's — a day summary
   * that changed as you paged would be no summary at all. */
  workedSeconds: number;
  /** Likewise the whole day, weighted by measured time. */
  activePercentage: number | null;
  /** The whole day's counts, slots added up; null when none were counted. */
  inputCounts: InputCounts | null;
  /** Whether activity is recorded for this member at all right now. */
  activityRecorded: boolean;
  /** Whether screenshots are captured for this member at all, so a slot
   * with no image can say why. */
  screenshotsEnabled: boolean;
}

/** Every instant here is UTC; the client renders them on the viewer's own
 * clock, like the Apps and URLs hour headers. */

/** Which page of the 10-minute view's hours to serve, and how many. */
export interface ScreenshotSlotsPagination {
  /** 1-based. Past the last page serves the last page instead. */
  page?: number;
  pageSize?: number;
  /** With no `page`: serve the page holding the hour this instant falls
   * in, so a link to a moment opens on it. Page 1 if that hour has no
   * tracked time. */
  focusAt?: Date;
}

export interface ScreenshotsFilter {
  /** undefined = every project; a string = that project only. Screenshots
   * no TimeEntry covers are never returned regardless. */
  projectId?: string;
}

/** The web gallery's page size, for a caller that doesn't name one. */
export const DEFAULT_SCREENSHOTS_PAGE_SIZE = 8;
/** Every item on a page costs a presigned URL and an image download. */
export const MAX_SCREENSHOTS_PAGE_SIZE = 48;

export interface ScreenshotsPagination {
  /** 1-based. Past the last page serves the last page instead. */
  page?: number;
  pageSize?: number;
  /** Newest capture first — for previews that want "the latest few". */
  newestFirst?: boolean;
}

export interface ScreenshotsPage {
  items: ScreenshotSummaryItem[];
  /** Every matching screenshot that day, across all pages. */
  total: number;
  /** The page actually served — lower than asked for when the request
   * ran past the end, e.g. after deleting the last page's screenshots. */
  page: number;
  pageSize: number;
}

/**
 * Indexes rather than built slots: the grouping runs *before* anything is
 * presigned, so only the served page costs its images. Keyed on each slot's
 * hour rather than counted off in sixes.
 */
function groupIndexesByHour(
  slots: { bounds: { start: number; end: number } }[],
): { slotIndexes: number[] }[] {
  const hours: { slotIndexes: number[] }[] = [];
  let currentKey: number | null = null;

  slots.forEach((slot, index) => {
    const key = Math.floor(slot.bounds.start / MS_PER_HOUR);
    if (key !== currentKey) {
      currentKey = key;
      hours.push({ slotIndexes: [] });
    }
    hours[hours.length - 1].slotIndexes.push(index);
  });

  return hours;
}

@Injectable()
export class ScreenshotsService {
  private readonly logger = new Logger(ScreenshotsService.name);

  constructor(
    @InjectRepository(Screenshot)
    private readonly screenshots: Repository<Screenshot>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly organisationsService: OrganisationsService,
    private readonly storage: ScreenshotStorageService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * Authorization (is the caller a logged-in device) is enforced upstream
   * by DeviceSessionGuard — reaching this method already implies a valid
   * device session for this organisation.
   */
  async requestUploadUrl(
    organisationId: string,
    deviceId: string,
    capturedAt: string,
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    const storageKey = this.storage.buildStorageKey(
      organisationId,
      deviceId,
      new Date(capturedAt),
    );
    const uploadUrl = await this.storage.createUploadUrl(storageKey);
    return { uploadUrl, storageKey };
  }

  async recordScreenshot(
    organisationId: string,
    userId: string,
    deviceId: string,
    storageKey: string,
    capturedAt: string,
  ): Promise<void> {
    // The key must actually be one this device was issued (via
    // requestUploadUrl above) — otherwise one device in the org could
    // record (and misattribute) a screenshot under another device's key.
    const expectedPrefix = `screenshots/${organisationId}/${deviceId}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        'storageKey was not issued to this device.',
      );
    }

    const membership = await this.getActiveMembership(organisationId, userId);
    const captureSettings =
      await this.organisationsService.getCaptureSettings(organisationId);
    const capturedAtDate = new Date(capturedAt);
    const keptUntil = new Date(
      capturedAtDate.getTime() +
        captureSettings.screenshotRetentionDays * MS_PER_DAY,
    );

    await this.screenshots.save(
      this.screenshots.create({
        organisationId,
        membershipId: membership.id,
        deviceId,
        storageKey,
        capturedAt: capturedAtDate,
        keptUntil,
      }),
    );
  }

  async getMyScreenshots(
    organisationId: string,
    userId: string,
    date?: string,
    filter: ScreenshotsFilter = {},
    pagination: ScreenshotsPagination = {},
  ): Promise<ScreenshotsPage> {
    // Members blocked from seeing their own activity get an empty page —
    // not a 403, which would itself reveal the data exists (see
    // OrganisationsService.mayViewOwnActivity).
    if (
      !(await this.organisationsService.mayViewOwnActivity(
        organisationId,
        userId,
      ))
    ) {
      return {
        items: [],
        total: 0,
        page: pagination.page ?? 1,
        pageSize: pagination.pageSize ?? DEFAULT_SCREENSHOTS_PAGE_SIZE,
      };
    }
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.listForMembershipId(
      organisationId,
      membership.id,
      await this.resolveDay(organisationId, date),
      filter,
      pagination,
    );
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or a manager for
   * their own team — peers never see each other's screenshots. Same rule
   * as AppEvent/Activity — see canViewMembership.
   */
  async getScreenshotsForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
    date?: string,
    filter: ScreenshotsFilter = {},
    pagination: ScreenshotsPagination = {},
  ): Promise<ScreenshotsPage> {
    const target = await this.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    return this.listForMembershipId(
      organisationId,
      target.id,
      await this.resolveDay(organisationId, date),
      filter,
      pagination,
    );
  }

  /**
   * A member's newest `limit` screenshots today, newest first — for
   * previews, which need neither a total nor the rest of the day. Unlike
   * a page, this never reads the whole day: rows come newest first in
   * small batches and reading stops once `limit` covered ones are found.
   * Same visibility rule as getScreenshotsForMembership.
   */
  async getLatestScreenshotsForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
    limit: number,
  ): Promise<ScreenshotSummaryItem[]> {
    const target = await this.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    const { start, end } = await this.resolveDay(organisationId);
    const coveringEntries = await this.timeEntriesService.listCoveringWindow(
      organisationId,
      target.id,
      start,
      end,
    );

    // Nearly every capture is covered (the agent only captures while a
    // timer runs), so one batch almost always suffices.
    const batchSize = limit * 2;
    const latest: { row: Screenshot; projectId: string | null }[] = [];
    for (let skip = 0; latest.length < limit; skip += batchSize) {
      const rows = await this.screenshots.find({
        select: { id: true, capturedAt: true, storageKey: true },
        where: {
          organisationId,
          membershipId: target.id,
          capturedAt: Between(start, end),
        },
        order: { capturedAt: 'DESC' },
        skip,
        take: batchSize,
      });
      for (const row of rows) {
        const entry = findEntryCovering(coveringEntries, row.capturedAt);
        if (entry) latest.push({ row, projectId: entry.projectId ?? null });
        if (latest.length === limit) break;
      }
      if (rows.length < batchSize) break;
    }

    return Promise.all(
      latest.map(async ({ row, projectId }) => ({
        id: row.id,
        capturedAt: row.capturedAt.toISOString(),
        url: await this.storage.createViewUrl(row.storageKey),
        projectId,
      })),
    );
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or a manager for
   * their own team — see canViewMembership.
   */
  private async getViewableMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
  ): Promise<Membership> {
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
        "You cannot view this member's screenshots.",
      );
    }
    return target;
  }

  /**
   * Coverage and the project filter both hinge on Time entries, so they
   * can't be pushed into the query — the day's rows are matched in memory
   * (only the three columns that needs), and the page is cut *after*
   * matching so `total` and page boundaries count only what is shown.
   * Signing a URL is the expensive part, so only the served page is
   * signed.
   */
  async getMySlots(
    organisationId: string,
    userId: string,
    date?: string,
    filter: ScreenshotsFilter = {},
    pagination: ScreenshotSlotsPagination = {},
  ): Promise<ScreenshotSlotsDay> {
    // Blocked members get an empty day, indistinguishable from "nothing
    // tracked" — the same stealth contract as getMyScreenshots.
    if (
      !(await this.organisationsService.mayViewOwnActivity(
        organisationId,
        userId,
      ))
    ) {
      return {
        hours: [],
        page: pagination.page ?? 1,
        pageSize: pagination.pageSize ?? DEFAULT_SLOT_HOURS_PAGE_SIZE,
        totalHours: 0,
        workedSeconds: 0,
        activePercentage: null,
        inputCounts: null,
        activityRecorded: false,
        screenshotsEnabled: false,
      };
    }
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.listSlotsForMembershipId(
      organisationId,
      membership.id,
      await this.resolveDay(organisationId, date),
      filter,
      pagination,
    );
  }

  /** Same visibility rule as `getScreenshotsForMembership`. */
  async getSlotsForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
    date?: string,
    filter: ScreenshotsFilter = {},
    pagination: ScreenshotSlotsPagination = {},
  ): Promise<ScreenshotSlotsDay> {
    const target = await this.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    return this.listSlotsForMembershipId(
      organisationId,
      target.id,
      await this.resolveDay(organisationId, date),
      filter,
      pagination,
    );
  }

  /** The 1-based page whose hours include `at`; page 1 without one. */
  private pageHolding(
    at: Date | undefined,
    hours: { slotIndexes: number[] }[],
    slots: { bounds: { start: number; end: number } }[],
    pageSize: number,
  ): number {
    if (!at) return 1;
    const ms = at.getTime();
    const index = hours.findIndex((hour) =>
      hour.slotIndexes.some(
        (slot) => ms >= slots[slot].bounds.start && ms < slots[slot].bounds.end,
      ),
    );
    return index === -1 ? 1 : Math.floor(index / pageSize) + 1;
  }

  /**
   * The day as 10-minute slots: what was captured, worked and measured in
   * each, grouped by hour, with the day's own totals on top.
   *
   * Two steps, cheapest first: the day's tracked time and samples decide
   * which page is served, and only then are that page's screenshots read.
   * The day's totals come from the first step, so they cost nothing extra.
   */
  private async listSlotsForMembershipId(
    organisationId: string,
    membershipId: string,
    { start, end }: ActivityDay,
    filter: ScreenshotsFilter,
    pagination: ScreenshotSlotsPagination,
  ): Promise<ScreenshotSlotsDay> {
    // Day-wide but small: a handful of entries and at most one sample per
    // ten minutes. The screenshots wait until the page is known..
    const [tracked, captureState] = await Promise.all([
      this.timeEntriesService.trackedDay(
        organisationId,
        membershipId,
        start,
        end,
      ),
      this.captureStateFor(organisationId, membershipId),
    ]);

    const window = { start: start.getTime(), end: end.getTime() };
    const projectIntervals =
      filter.projectId === undefined
        ? tracked.intervals
        : tracked.intervals.filter(
            (interval) => interval.projectId === filter.projectId,
          );

    const slots = slotsBetween(start, end).map((bounds) => {
      const workedSeconds = workedSecondsIn(projectIntervals, bounds);
      // Samples outlive the entry that produced them (capture pruning
      // covers screenshots, app events and URL sessions, not these), and
      // activity against untracked time is the "Untracked" noise the
      // Activity views refuse.
      const activity =
        workedSeconds > 0
          ? activityIn(tracked.samples, bounds)
          : { activePercentage: null, measuredSeconds: 0 };
      return {
        bounds,
        projectId: dominantProjectIn(projectIntervals, bounds),
        workedSeconds,
        activePercentage: activity.activePercentage,
        activityMeasuredSeconds: activity.measuredSeconds,
        // Same rule as the percentage: nothing against untracked time.
        inputCounts:
          workedSeconds > 0 ? inputCountsIn(tracked.samples, bounds) : null,
      };
    });

    // Newest hour first, the order the timesheet lists entries in; slots
    // stay chronological within an hour. Empty hours go before paging, so
    // no page is ever blank.
    const withWork = groupIndexesByHour(slots)
      .filter((hour) =>
        hour.slotIndexes.some((index) => slots[index].workedSeconds > 0),
      )
      .reverse();
    const pageSize = pagination.pageSize ?? DEFAULT_SLOT_HOURS_PAGE_SIZE;
    const lastPage = Math.max(1, Math.ceil(withWork.length / pageSize));
    const page = Math.min(
      pagination.page ??
        this.pageHolding(pagination.focusAt, withWork, slots, pageSize),
      lastPage,
    );
    const onPage = withWork.slice((page - 1) * pageSize, page * pageSize);

    // Only now, and only across the served hours.
    const pageIndexes = onPage.flatMap((hour) => hour.slotIndexes);
    const rows = await this.screenshotsIn(
      organisationId,
      membershipId,
      pageIndexes.map((index) => slots[index].bounds),
    );

    // Attributed by the slot they fall in, then filtered the same way the
    // gallery filters: a screenshot no Time entry covers is never shown.
    const bySlot = new Map<number, Screenshot[]>();
    for (const row of rows) {
      const capturedMs = row.capturedAt.getTime();
      if (capturedMs < window.start || capturedMs >= window.end) continue;
      const index = pageIndexes.find(
        (candidate) =>
          capturedMs >= slots[candidate].bounds.start &&
          capturedMs < slots[candidate].bounds.end,
      );
      if (index === undefined) continue;
      if (slots[index].workedSeconds === 0) continue;
      if (
        filter.projectId !== undefined &&
        slots[index].projectId !== filter.projectId
      ) {
        continue;
      }
      bySlot.set(index, [...(bySlot.get(index) ?? []), row]);
    }

    const hours: ScreenshotSlotHour[] = await Promise.all(
      onPage.map(async (hour) => {
        const builtSlots = await Promise.all(
          hour.slotIndexes.map(async (index) => {
            const slot = slots[index];
            const inSlot = bySlot.get(index) ?? [];
            const shown = inSlot.slice(0, MAX_SLOT_SCREENSHOTS);
            return {
              start: new Date(slot.bounds.start).toISOString(),
              end: new Date(slot.bounds.end).toISOString(),
              projectId: slot.projectId,
              workedSeconds: slot.workedSeconds,
              activePercentage: slot.activePercentage,
              activityMeasuredSeconds: slot.activityMeasuredSeconds,
              inputCounts: slot.inputCounts,
              screenshots: await Promise.all(
                shown.map(async (row) => ({
                  id: row.id,
                  capturedAt: row.capturedAt.toISOString(),
                  url: await this.storage.createViewUrl(row.storageKey),
                  projectId: slot.projectId,
                })),
              ),
              extraCount: Math.max(0, inSlot.length - shown.length),
            };
          }),
        );
        const last = slots[hour.slotIndexes[hour.slotIndexes.length - 1]];
        return {
          start: builtSlots[0].start,
          // The union across the whole hour, not its slots added up.
          workedSeconds: workedSecondsIn(projectIntervals, {
            start: slots[hour.slotIndexes[0]].bounds.start,
            end: last.bounds.end,
          }),
          slots: builtSlots,
        };
      }),
    );

    return {
      hours,
      page,
      pageSize,
      totalHours: withWork.length,
      // The union across the day, not the slots added up (docs/adr/0022),
      // and never just this page's — a summary that moved as you paged
      // would be no summary.
      workedSeconds: workedSecondsIn(projectIntervals, window),
      activePercentage: weightedAverage(
        slots.map((slot) => ({
          activePercentage: slot.activePercentage,
          measuredSeconds: slot.activityMeasuredSeconds,
        })),
      ),
      inputCounts: sumInputCounts(slots.map((slot) => slot.inputCounts)),
      activityRecorded: captureState.activityRecorded,
      screenshotsEnabled: captureState.screenshotsEnabled,
    };
  }

  /** One query spanning the windows rather than one each: a page's hours
   * are contiguous, so the span is barely wider than their union. */
  private async screenshotsIn(
    organisationId: string,
    membershipId: string,
    windows: { start: number; end: number }[],
  ): Promise<Screenshot[]> {
    if (windows.length === 0) return [];

    const from = new Date(Math.min(...windows.map((w) => w.start)));
    const to = new Date(Math.max(...windows.map((w) => w.end)));
    return await this.screenshots.find({
      select: { id: true, capturedAt: true, storageKey: true },
      where: {
        organisationId,
        membershipId,
        capturedAt: Between(from, to),
      },
      order: { capturedAt: 'ASC' },
    });
  }

  private async listForMembershipId(
    organisationId: string,
    membershipId: string,
    { start, end }: ActivityDay,
    filter: ScreenshotsFilter,
    pagination: ScreenshotsPagination,
  ): Promise<ScreenshotsPage> {
    const [rows, coveringEntries] = await Promise.all([
      this.screenshots.find({
        select: { id: true, capturedAt: true, storageKey: true },
        where: {
          organisationId,
          membershipId,
          capturedAt: Between(start, end),
        },
        order: { capturedAt: pagination.newestFirst ? 'DESC' : 'ASC' },
      }),
      this.timeEntriesService.listCoveringWindow(
        organisationId,
        membershipId,
        start,
        end,
      ),
    ]);

    // Hidden, not deleted, while no Time entry covers it — see
    // AppEventsService for the reasoning.
    const matching = rows.flatMap((row) => {
      const entry = findEntryCovering(coveringEntries, row.capturedAt);
      if (!entry) return [];
      const projectId = entry.projectId ?? null;
      if (filter.projectId !== undefined && projectId !== filter.projectId) {
        return [];
      }
      return [{ row, projectId }];
    });

    const pageSize = pagination.pageSize ?? DEFAULT_SCREENSHOTS_PAGE_SIZE;
    const lastPage = Math.max(1, Math.ceil(matching.length / pageSize));
    const page = Math.min(pagination.page ?? 1, lastPage);
    const onPage = matching.slice((page - 1) * pageSize, page * pageSize);

    const items = await Promise.all(
      onPage.map(async ({ row, projectId }) => ({
        id: row.id,
        capturedAt: row.capturedAt.toISOString(),
        url: await this.storage.createViewUrl(row.storageKey),
        projectId,
      })),
    );

    return { items, total: matching.length, page, pageSize };
  }

  /**
   * Retention cleanup — deletes both the DB row and the underlying Wasabi
   * object for every screenshot whose `keptUntil` has passed. Runs hourly
   * rather than daily so a short retention window (e.g. an admin testing
   * "1 day") is honoured promptly rather than waiting up to a full day.
   * `keptUntil` was fixed at capture time from the org's
   * `screenshotRetentionDays` setting then in effect (see Screenshot
   * entity's own comment) — this job never re-reads the org's *current*
   * setting, it just honours what was already computed.
   *
   * Works through every expired screenshot, oldest first, until none are
   * left or the time budget runs out. One batch an hour used to be the
   * limit: 500 an hour is 12,000 a day, and at the default frequency about
   * 250 people tracking all day add more than that, so the backlog grew for
   * ever and screenshots outlived their retention.
   *
   * A row is deleted only once its object is. One the store refused keeps
   * its row, so it is retried next hour rather than left behind in storage
   * with nothing pointing at it. Batches are read from a cursor, not from
   * the top, so a refused row isn't read again and again within one run.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpired(
    timeBudgetMs = RETENTION_CLEANUP_TIME_BUDGET_MS,
  ): Promise<{ deleted: number; failed: number }> {
    const startedAt = Date.now();
    const now = new Date();
    let cursor: { keptUntil: Date; id: string } | null = null;
    let deleted = 0;
    let failed = 0;

    while (Date.now() - startedAt < timeBudgetMs) {
      const query = this.screenshots
        .createQueryBuilder('screenshot')
        .select([
          'screenshot.id',
          'screenshot.storageKey',
          'screenshot.keptUntil',
        ])
        .where('screenshot.keptUntil < :now', { now })
        .orderBy('screenshot.keptUntil', 'ASC')
        .addOrderBy('screenshot.id', 'ASC')
        .limit(RETENTION_CLEANUP_BATCH_SIZE);
      if (cursor) {
        query.andWhere(
          '(screenshot.keptUntil, screenshot.id) > (:cursorKeptUntil, :cursorId)',
          { cursorKeptUntil: cursor.keptUntil, cursorId: cursor.id },
        );
      }
      const expired = await query.getMany();
      if (expired.length === 0) break;

      const refused = new Set(
        await this.storage.deleteObjects(expired.map((row) => row.storageKey)),
      );
      const gone = expired.filter((row) => !refused.has(row.storageKey));
      if (gone.length > 0) {
        await this.screenshots.delete({ id: In(gone.map((row) => row.id)) });
      }
      deleted += gone.length;
      failed += expired.length - gone.length;

      // The store refused the whole batch: it is down, or refusing
      // everything, and the next batch would fare no better.
      if (gone.length === 0) break;
      const last = expired[expired.length - 1];
      cursor = { keptUntil: last.keptUntil, id: last.id };
    }

    if (failed > 0) {
      this.logger.warn(
        `Screenshot retention: deleted ${deleted}, kept ${failed} whose stored object could not be deleted; they will be retried next hour.`,
      );
    }
    return { deleted, failed };
  }

  /** For explaining an empty slot, never for gating one. */
  private async captureStateFor(
    organisationId: string,
    membershipId: string,
  ): Promise<{ activityRecorded: boolean; screenshotsEnabled: boolean }> {
    const membership = await this.memberships.findOne({
      where: { id: membershipId, organisationId },
    });
    const { activityTrackingEnabled, screenshotsEnabled } =
      await this.organisationsService.getCaptureSettings(
        organisationId,
        membership?.userId,
      );
    return { activityRecorded: activityTrackingEnabled, screenshotsEnabled };
  }

  /**
   * The caller's `?date=`, or today, on the organisation's calendar — the
   * same days the Apps, URLs and Notes tabs beside it and Timesheets use,
   * so their totals describe the same window.
   */
  private async resolveDay(
    organisationId: string,
    date?: string,
  ): Promise<ActivityDay> {
    const { timezone } =
      await this.organisationsService.getWeekCalendar(organisationId);
    return activityDayIn(date, timezone);
  }

  /**
   * An admin may delete anyone's; everyone else only their own, and only
   * while the Organisation (or their own override) allows it.
   */
  async deleteScreenshot(
    organisationId: string,
    userId: string,
    screenshotId: string,
  ): Promise<void> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const screenshot = await this.screenshots.findOne({
      where: { id: screenshotId, organisationId },
    });
    if (!screenshot) {
      throw new NotFoundException('Screenshot not found.');
    }

    const isAdmin = membership.role === MembershipRole.ADMIN;
    if (!isAdmin) {
      if (screenshot.membershipId !== membership.id) {
        throw new ForbiddenException(
          'You can only delete your own screenshots.',
        );
      }
      const allowed =
        membership.canDeleteScreenshots ??
        (await this.organisationsService.membersCanDeleteScreenshots(
          organisationId,
        ));
      if (!allowed) {
        throw new ForbiddenException(
          'Your organisation does not allow deleting your own screenshots.',
        );
      }
    }

    // Row first: an object left behind is invisible clutter, where a row
    // pointing at a deleted object is a broken tile in the gallery.
    await this.screenshots.delete({ id: screenshot.id });
    await this.storage.deleteObjects([screenshot.storageKey]);
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
