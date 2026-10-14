import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, In, LessThan, Repository } from 'typeorm';
import { canViewMembership } from '../../common/membership-visibility.util';
import { findEntryCovering } from '../../common/time-entry-coverage.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Screenshot } from '../../database/entities/screenshot.entity';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { ScreenshotStorageService } from './screenshot-storage.service';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Caps how many expired rows one retention sweep processes — keeps a
 * single cron tick fast and bounded even behind a large backlog (e.g. an
 * org that just shortened its retention). The next hourly run picks up
 * wherever this one left off, so nothing is ever skipped, just spread out.
 */
const RETENTION_CLEANUP_BATCH_SIZE = 500;

export interface ScreenshotSummaryItem {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — never a permanent/public link. */
  url: string;
  /** The project whose TimeEntry covered `capturedAt` — null if no timer
   * was running (the common case; see time-entry-coverage.util.ts). */
  projectId: string | null;
}

export interface ScreenshotsFilter {
  /** undefined = every project; a string = that project only. Screenshots
   * no TimeEntry covers are never returned regardless. */
  projectId?: string;
}

@Injectable()
export class ScreenshotsService {
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
  ): Promise<ScreenshotSummaryItem[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.listForMembershipId(
      organisationId,
      membership.id,
      this.resolveDate(date),
      filter,
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
  ): Promise<ScreenshotSummaryItem[]> {
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

    return this.listForMembershipId(
      organisationId,
      target.id,
      this.resolveDate(date),
      filter,
    );
  }

  private async listForMembershipId(
    organisationId: string,
    membershipId: string,
    date: string,
    filter: ScreenshotsFilter = {},
  ): Promise<ScreenshotSummaryItem[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + MS_PER_DAY);

    const [rows, coveringEntries] = await Promise.all([
      this.screenshots.find({
        where: {
          organisationId,
          membershipId,
          capturedAt: Between(start, end),
        },
        order: { capturedAt: 'ASC' },
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
    const covered = rows.filter(
      (row) => findEntryCovering(coveringEntries, row.capturedAt) !== undefined,
    );

    const items = await Promise.all(
      covered.map(async (row) => {
        const projectId =
          findEntryCovering(coveringEntries, row.capturedAt)?.projectId ?? null;
        return {
          id: row.id,
          capturedAt: row.capturedAt.toISOString(),
          url: await this.storage.createViewUrl(row.storageKey),
          projectId,
        };
      }),
    );

    if (filter.projectId === undefined) {
      return items;
    }
    return items.filter((item) => item.projectId === filter.projectId);
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
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpired(): Promise<void> {
    const expired = await this.screenshots.find({
      where: { keptUntil: LessThan(new Date()) },
      take: RETENTION_CLEANUP_BATCH_SIZE,
    });
    if (expired.length === 0) return;

    await this.storage.deleteObjects(expired.map((row) => row.storageKey));
    await this.screenshots.delete({
      id: In(expired.map((row) => row.id)),
    });
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

  /**
   * Removes one screenshot and the object behind it. An admin may delete
   * anyone's; everyone else only their own, and only while the
   * Organisation allows it — a capture is evidence of someone's work, so
   * the power to erase it is granted, not assumed.
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
