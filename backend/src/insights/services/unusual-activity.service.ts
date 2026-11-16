import { Injectable } from '@nestjs/common';
import { dateKeyInZone } from '../../common/calendar-week.util';
import { addDaysToKey, startOfDayInZone } from '../../common/zoned-time.util';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { buildTimelineDays, DayBounds } from '../timeline.util';
import {
  affectedSecondsBySeverity,
  BASELINE_DAYS,
  buildUnusualInstances,
  findUnusualActivity,
  normalRulesFor,
  UnusualInstance,
  UnusualRule,
  UnusualSeverity,
} from '../unusual-activity.util';
import { ActivityStatus, InsightsService } from './insights.service';

/** The window the range is compared with: the days just before it. */
const COMPARISON_DAYS = 60;

export interface MemberUnusualActivity {
  membershipId: string;
  timezone: string;
  activityStatus: ActivityStatus;
  /**
   * The last day included. A day is only checked once it's over, so today
   * (and anything later) is left out; `null` when no day in the range is.
   */
  checkedThrough: string | null;
  instances: UnusualInstance[];
  affectedSeconds: Record<UnusualSeverity, number>;
  previousPeriod: {
    from: string;
    to: string;
    affectedSeconds: Record<UnusualSeverity, number>;
  };
  /** Rules not flagged because they're this member's usual way of working. */
  normalForMember: UnusualRule[];
}

@Injectable()
export class UnusualActivityService {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly organisationsService: OrganisationsService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * Stretches in the range that don't look like ordinary work, beside the
   * time affected in the 60 days before. Each period is first compared
   * with the member's own previous 30 days, so a pattern that's simply how
   * they work isn't flagged over and over.
   */
  async getUnusualActivity(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string | undefined,
    from: string,
    to: string,
  ): Promise<MemberUnusualActivity> {
    const { caller, target } = await this.insightsService.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    this.insightsService.dayKeysBetween(from, to);

    const [{ timezone }, activityStatus] = await Promise.all([
      this.organisationsService.getWeekCalendar(organisationId),
      this.insightsService.activityStatusFor(organisationId, caller, target),
    ]);
    const now = new Date();
    const lastCompleteDay = addDaysToKey(dateKeyInZone(now, timezone), -1);
    const previousFrom = addDaysToKey(from, -COMPARISON_DAYS);
    const previousTo = addDaysToKey(from, -1);
    const empty = (): Record<UnusualSeverity, number> => ({
      highly_unusual: 0,
      unusual: 0,
      slightly_unusual: 0,
    });

    const result: MemberUnusualActivity = {
      membershipId: target.id,
      timezone,
      activityStatus,
      checkedThrough:
        from <= lastCompleteDay ? minKey(to, lastCompleteDay) : null,
      instances: [],
      affectedSeconds: empty(),
      previousPeriod: {
        from: previousFrom,
        to: previousTo,
        affectedSeconds: empty(),
      },
      normalForMember: [],
    };
    // Nothing is measured without recording, and a member who may not see
    // their own activity doesn't see what's read off it either.
    if (activityStatus !== 'recorded') return result;

    // One read covers the range, the 60 days before it, and the 30-day
    // baseline before each of those.
    const firstKey = addDaysToKey(previousFrom, -BASELINE_DAYS);
    const lastKey = minKey(to, lastCompleteDay);
    if (firstKey > lastKey) return result;
    const days: DayBounds[] = keysBetween(firstKey, lastKey).map((date) => ({
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
    const findings = findUnusualActivity(
      days,
      buildTimelineDays(
        days,
        window.entries,
        window.pausesByEntry,
        window.samples,
        now,
      ),
      window.samples,
    );

    const between = (a: string, b: string) =>
      findings.filter((finding) => finding.date >= a && finding.date <= b);
    const unusualFor = (a: string, b: string) => {
      const normal = normalRulesFor(
        between(addDaysToKey(a, -BASELINE_DAYS), addDaysToKey(a, -1)),
      );
      return {
        normal,
        instances: buildUnusualInstances(between(a, b), normal),
      };
    };

    const current = unusualFor(from, to);
    const previous = unusualFor(previousFrom, previousTo);
    return {
      ...result,
      instances: current.instances,
      affectedSeconds: affectedSecondsBySeverity(current.instances),
      previousPeriod: {
        ...result.previousPeriod,
        affectedSeconds: affectedSecondsBySeverity(previous.instances),
      },
      normalForMember: current.normal,
    };
  }
}

function minKey(a: string, b: string): string {
  return a < b ? a : b;
}

function keysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  for (let key = from; key <= to; key = addDaysToKey(key, 1)) keys.push(key);
  return keys;
}
