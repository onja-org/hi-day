import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { canViewMembership } from '../../common/membership-visibility.util';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { AppEventItemDto } from '../dto/app-event-item.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every sample is treated as representing this many seconds of foreground
 * time — an approximation (not a measured duration), matching the desktop
 * agent's own default sampling interval
 * (desktop/src/main/window-sampler.ts's DEFAULT_WINDOW_SAMPLE_INTERVAL_MS).
 * Good enough for a first cut per docs/adr/0010-...; a gap-based
 * calculation (time between consecutive samples) would be more precise if
 * the interval ever becomes configurable per-org.
 */
const SAMPLE_INTERVAL_SECONDS = 5;

export interface AppTimeSummaryItem {
  appName: string;
  secondsSpent: number;
}

export interface AppTimeSummary {
  date: string;
  totalSecondsSpent: number;
  items: AppTimeSummaryItem[];
}

@Injectable()
export class AppEventsService {
  constructor(
    @InjectRepository(AppEvent)
    private readonly appEvents: Repository<AppEvent>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
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

    const rows = events.map((event) =>
      this.appEvents.create({
        organisationId,
        membershipId: membership.id,
        deviceId,
        appName: event.appName,
        title: event.title ?? null,
        titleUnavailableReason: event.titleUnavailableReason ?? null,
        sampledAt: new Date(event.sampledAt),
      }),
    );

    await this.appEvents.save(rows);
  }

  async getMySummary(
    organisationId: string,
    userId: string,
    date?: string,
  ): Promise<AppTimeSummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    return this.summariseForMembershipId(
      organisationId,
      membership.id,
      this.resolveDate(date),
    );
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or a manager for
   * their own team — peers never see each other's app activity. See
   * canViewMembership for the shared rule (same as Activities/TimeEntries).
   */
  async getSummaryForMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string,
    date?: string,
  ): Promise<AppTimeSummary> {
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

    return this.summariseForMembershipId(
      organisationId,
      target.id,
      this.resolveDate(date),
    );
  }

  private async summariseForMembershipId(
    organisationId: string,
    membershipId: string,
    date: string,
  ): Promise<AppTimeSummary> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const rows = await this.appEvents
      .createQueryBuilder('event')
      .select('event.appName', 'appName')
      .addSelect('COUNT(*)', 'sampleCount')
      .where('event.organisationId = :organisationId', { organisationId })
      .andWhere('event.membershipId = :membershipId', { membershipId })
      .andWhere('event.sampledAt >= :start', { start })
      .andWhere('event.sampledAt < :end', { end })
      .groupBy('event.appName')
      .orderBy('"sampleCount"', 'DESC')
      .getRawMany<{ appName: string; sampleCount: string }>();

    const items = rows.map((row) => ({
      appName: row.appName,
      secondsSpent: Number(row.sampleCount) * SAMPLE_INTERVAL_SECONDS,
    }));

    return {
      date,
      totalSecondsSpent: items.reduce(
        (sum, item) => sum + item.secondsSpent,
        0,
      ),
      items,
    };
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
