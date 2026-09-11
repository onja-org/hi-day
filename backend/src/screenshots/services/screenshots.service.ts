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
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Screenshot } from '../../database/entities/screenshot.entity';
import { OrganisationsService } from '../../organisations/services/organisations.service';
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

/** The ActivitySample (if any) whose period contains `capturedAt` — a time-overlap lookup, not a shared foreign key. */
function findSampleCovering(
  samples: ActivitySample[],
  capturedAt: Date,
): ActivitySample | undefined {
  return samples.find(
    (sample) =>
      sample.periodStart <= capturedAt && capturedAt < sample.periodEnd,
  );
}

export interface ScreenshotSummaryItem {
  id: string;
  capturedAt: string;
  /** Presigned, time-limited GET URL — never a permanent/public link. */
  url: string;
  /** The covering ActivitySample's activity level (see docs/adr/0013-...), or `null` if none covers `capturedAt`. */
  activePercentage: number | null;
  periodStart: string | null;
  periodEnd: string | null;
}

@Injectable()
export class ScreenshotsService {
  constructor(
    @InjectRepository(Screenshot)
    private readonly screenshots: Repository<Screenshot>,
    @InjectRepository(ActivitySample)
    private readonly activitySamples: Repository<ActivitySample>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly organisationsService: OrganisationsService,
    private readonly storage: ScreenshotStorageService,
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
  ): Promise<ScreenshotSummaryItem[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.listForMembershipId(
      organisationId,
      membership.id,
      this.resolveDate(date),
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
    );
  }

  private async listForMembershipId(
    organisationId: string,
    membershipId: string,
    date: string,
  ): Promise<ScreenshotSummaryItem[]> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + MS_PER_DAY);

    const [rows, samples] = await Promise.all([
      this.screenshots.find({
        where: {
          organisationId,
          membershipId,
          capturedAt: Between(start, end),
        },
        order: { capturedAt: 'ASC' },
      }),
      this.activitySamples.find({
        where: {
          organisationId,
          membershipId,
          periodStart: Between(start, end),
        },
        order: { periodStart: 'ASC' },
      }),
    ]);

    return Promise.all(
      rows.map(async (row) => {
        const sample = findSampleCovering(samples, row.capturedAt);
        return {
          id: row.id,
          capturedAt: row.capturedAt.toISOString(),
          url: await this.storage.createViewUrl(row.storageKey),
          activePercentage: sample?.activePercentage ?? null,
          periodStart: sample ? sample.periodStart.toISOString() : null,
          periodEnd: sample ? sample.periodEnd.toISOString() : null,
        };
      }),
    );
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
