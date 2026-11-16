import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { canViewMembership } from '../../common/membership-visibility.util';
import { dateKeyInZone } from '../../common/calendar-week.util';
import { addDaysToKey, startOfDayInZone } from '../../common/zoned-time.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import type { AppUrlTracking } from '../../organisations/app-url-tracking';
import { resolveActivityTrackingEnabled } from '../../organisations/capture-settings';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { WorkClassificationService } from '../../work-classification/services/work-classification.service';
import type { WorkTimeSplit } from '../../work-classification/work-classification.util';
import {
  averagePerformance,
  computeMemberPerformance,
  MemberPerformance,
  PerformanceAverages,
} from '../performance.util';
import { buildTimelineDays, DayBounds, TimelineDay } from '../timeline.util';

/** One request covers at most this many days — a month, plus slack for 31. */
export const MAX_TIMELINE_DAYS = 31;

/**
 * Whether the member's activity can be shown beside their time:
 * - `recorded`: "Record activity" is on for them.
 * - `disabled`: it's off, so the UI says "Record activity disabled" and
 *   no percentages are sent, not even ones recorded before it went off.
 * - `hidden`: the caller is viewing themselves and may not see their own
 *   activity. Percentages are stripped and the UI drops the activity row,
 *   so they can't tell it's being collected (see `mayViewOwnActivity`).
 */
export type ActivityStatus = 'recorded' | 'disabled' | 'hidden';

export interface MemberTimeline {
  membershipId: string;
  timezone: string;
  activityStatus: ActivityStatus;
  days: TimelineDay[];
}

/**
 * Core vs non-core time. `not_available` while app/URL tracking is off for
 * the member (or they may not see their own activity); `no_data` when no
 * app time was tracked in the range.
 */
export type WorkTimeClassification =
  | { status: 'not_available' }
  | { status: 'no_data' }
  | ({ status: 'available' } & WorkTimeSplit);

export interface MemberPerformanceReport {
  membershipId: string;
  timezone: string;
  activityStatus: ActivityStatus;
  /** Activity and focus are `null` unless `activityStatus` is `recorded`. */
  member: MemberPerformance;
  averages: {
    organisation: PerformanceAverages;
    /** `null` when the member is on no team. */
    team: PerformanceAverages | null;
  };
  workTimeClassification: WorkTimeClassification;
}

@Injectable()
export class InsightsService {
  constructor(
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly organisationsService: OrganisationsService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly workClassificationService: WorkClassificationService,
  ) {}

  async getTimeline(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string | undefined,
    from: string,
    to: string,
  ): Promise<MemberTimeline> {
    const { caller, target } = await this.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    const dayKeys = this.dayKeysBetween(from, to);

    const [{ timezone }, activityStatus] = await Promise.all([
      this.organisationsService.getWeekCalendar(organisationId),
      this.activityStatusFor(organisationId, caller, target),
    ]);
    const days: DayBounds[] = dayKeys.map((date) => ({
      date,
      start: startOfDayInZone(date, timezone),
      end: startOfDayInZone(addDaysToKey(date, 1), timezone),
    }));

    const window = await this.timeEntriesService.timelineWindow(
      organisationId,
      target.id,
      days[0].start,
      days[days.length - 1].end,
    );
    const built = buildTimelineDays(
      days,
      window.entries,
      window.pausesByEntry,
      // Only while recording: once it's off, past figures go too, so
      // the page never shows activity beside "Record activity disabled".
      activityStatus === 'recorded' ? window.samples : [],
      new Date(),
    );

    return {
      membershipId: target.id,
      timezone,
      activityStatus,
      days: built,
    };
  }

  /**
   * The member's six Performance figures, beside the same figures averaged
   * over the whole organisation and over the teams they're on. Averages are
   * aggregates, so a manager comparing against the organisation sees no
   * individual outside their teams.
   */
  async getPerformance(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string | undefined,
    from: string,
    to: string,
  ): Promise<MemberPerformanceReport> {
    const { caller, target } = await this.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    const dayKeys = this.dayKeysBetween(from, to);

    const [defaults, activityStatus, members] = await Promise.all([
      this.organisationsService.getInsightsDefaults(organisationId),
      this.activityStatusFor(organisationId, caller, target),
      this.memberships.find({
        where: { organisationId, status: MembershipStatus.ACTIVE },
        relations: { teamMemberships: true },
      }),
    ]);
    const days: DayBounds[] = dayKeys.map((date) => ({
      date,
      start: startOfDayInZone(date, defaults.timezone),
      end: startOfDayInZone(addDaysToKey(date, 1), defaults.timezone),
    }));
    const now = new Date();
    const todayKey = dateKeyInZone(now, defaults.timezone);

    // The target may be deactivated and still viewable; they're always
    // measured, even when the averages below leave them out.
    const everyone = members.some((member) => member.id === target.id)
      ? members
      : [...members, target];
    const windows = await this.timeEntriesService.timelineWindows(
      organisationId,
      everyone.map((member) => member.id),
      days[0].start,
      days[days.length - 1].end,
    );

    const performanceOf = (member: Membership): MemberPerformance => {
      const window = windows.get(member.id)!;
      const recording =
        member.id === target.id
          ? activityStatus === 'recorded'
          : resolveActivityTrackingEnabled(
              defaults.activityTrackingEnabled,
              member.activityTrackingEnabled,
            );
      const samples = recording ? window.samples : [];
      return computeMemberPerformance({
        days,
        timeline: buildTimelineDays(
          days,
          window.entries,
          window.pausesByEntry,
          samples,
          now,
        ),
        samples,
        expectedWorkDays: member.expectedWorkDays ?? defaults.expectedWorkDays,
        hoursPerDay: defaults.hoursPerDay,
        todayKey,
      });
    };

    const performances = new Map(
      everyone.map((member) => [member.id, performanceOf(member)]),
    );
    const targetTeamIds = new Set(
      (target.teamMemberships ?? []).map((link) => link.teamId),
    );
    const teamMembers = members.filter((member) =>
      (member.teamMemberships ?? []).some((link) =>
        targetTeamIds.has(link.teamId),
      ),
    );
    const averageOf = (group: Membership[]) =>
      this.withoutActivity(
        averagePerformance(group.map((member) => performances.get(member.id)!)),
        activityStatus === 'hidden',
      );

    const member = performances.get(target.id)!;
    return {
      membershipId: target.id,
      timezone: defaults.timezone,
      activityStatus,
      member:
        activityStatus === 'hidden'
          ? { ...member, activity: null, focus: null }
          : member,
      averages: {
        organisation: averageOf(members),
        team: targetTeamIds.size > 0 ? averageOf(teamMembers) : null,
      },
      workTimeClassification: await this.workTimeClassificationFor(
        organisationId,
        target,
        defaults.appUrlTracking,
        activityStatus,
        days,
      ),
    };
  }

  /**
   * The target's own split only — averages would mean reading every
   * member's app time. Highlights reads it per period with the same rules.
   */
  async workTimeClassificationFor(
    organisationId: string,
    target: Membership,
    organisationTracking: AppUrlTracking,
    activityStatus: ActivityStatus,
    days: DayBounds[],
  ): Promise<WorkTimeClassification> {
    const tracking = target.appUrlTracking ?? organisationTracking;
    if (tracking === 'off' || activityStatus === 'hidden') {
      return { status: 'not_available' };
    }
    const split = await this.workClassificationService.splitForMember(
      organisationId,
      target.id,
      days[0].start,
      days[days.length - 1].end,
    );
    const total =
      split.coreSeconds + split.nonCoreSeconds + split.unclassifiedSeconds;
    return total === 0
      ? { status: 'no_data' }
      : { status: 'available', ...split };
  }

  /** A viewer who may not see their own activity doesn't get it as an average either. */
  private withoutActivity(
    averages: PerformanceAverages,
    hide: boolean,
  ): PerformanceAverages {
    return hide
      ? { ...averages, activityPercentage: null, focusSeconds: null }
      : averages;
  }

  /**
   * Visible to: the member themselves, an admin (anyone), or whoever
   * manages a team the member is on — the rule every other per-member read
   * uses (see canViewMembership). No `targetMembershipId` means the
   * caller's own, which is how a member who can't list anyone else gets in.
   */
  async getViewableMembership(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string | undefined,
  ): Promise<{ caller: Membership; target: Membership }> {
    const caller = await this.memberships.findOne({
      where: {
        userId: callerUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { teamMemberships: true },
    });
    const target =
      targetMembershipId === undefined || targetMembershipId === caller?.id
        ? caller
        : await this.memberships.findOne({
            where: { id: targetMembershipId, organisationId },
            relations: { teamMemberships: true },
          });

    if (!caller || !target) {
      throw new NotFoundException('Membership not found.');
    }
    if (!canViewMembership(caller, target)) {
      throw new ForbiddenException("You cannot view this member's insights.");
    }
    return { caller, target };
  }

  async activityStatusFor(
    organisationId: string,
    caller: Membership,
    target: Membership,
  ): Promise<ActivityStatus> {
    if (
      caller.id === target.id &&
      !(await this.organisationsService.mayViewOwnActivity(
        organisationId,
        caller.userId,
      ))
    ) {
      return 'hidden';
    }
    const { activityTrackingEnabled } =
      await this.organisationsService.getCaptureSettings(
        organisationId,
        target.userId,
      );
    return activityTrackingEnabled ? 'recorded' : 'disabled';
  }

  /** Every calendar day from `from` to `to`, both included. */
  dayKeysBetween(from: string, to: string): string[] {
    if (from > to) {
      throw new BadRequestException('from must not be after to.');
    }
    const keys: string[] = [];
    for (let key = from; key <= to; key = addDaysToKey(key, 1)) {
      keys.push(key);
      if (keys.length > MAX_TIMELINE_DAYS) {
        throw new BadRequestException(
          `A timeline covers at most ${MAX_TIMELINE_DAYS} days.`,
        );
      }
    }
    return keys;
  }
}
