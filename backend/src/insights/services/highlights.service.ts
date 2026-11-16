import { Injectable } from '@nestjs/common';
import { dateKeyInZone } from '../../common/calendar-week.util';
import { addDaysToKey, startOfDayInZone } from '../../common/zoned-time.util';
import type { Membership } from '../../database/entities/membership.entity';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import {
  BehaviourChange,
  COMPARISON_PERIODS,
  findBehaviourChanges,
  PeriodFigures,
} from '../behaviour-change.util';
import { computeMemberPerformance } from '../performance.util';
import { buildTimelineDays, DayBounds } from '../timeline.util';
import { UnusualInstance, UnusualSeverity } from '../unusual-activity.util';
import { ActivityStatus, InsightsService } from './insights.service';
import { UnusualActivityService } from './unusual-activity.service';

export interface MemberHighlights {
  membershipId: string;
  timezone: string;
  activityStatus: ActivityStatus;
  /**
   * The last day included — like Unusual activity, only finished days are
   * looked at. `null` when no day in the range is over yet.
   */
  checkedThrough: string | null;
  /** The same figures as the Unusual activity page for this member and range. */
  unusualActivity: {
    counts: Record<UnusualSeverity, number>;
    affectedSeconds: number;
    previousAffectedSeconds: number;
    /** The most serious instances, at most `TOP_INSTANCES`; the page links to the rest. */
    topInstances: UnusualInstance[];
  };
  behaviourChanges: {
    /** The earlier periods, from the first one's start to the last one's end. */
    comparedWith: { from: string; to: string; periods: number } | null;
    /** Length of the selected range, and so of each earlier period. */
    periodDays: number;
    /**
     * How many of its days are over and were compared — fewer than
     * `periodDays` while the range runs into today, and then only the
     * same days of each earlier period count.
     */
    checkedDays: number;
    changes: BehaviourChange[];
  };
}

/** How many instances Highlights lists before pointing to Unusual activity. */
export const TOP_INSTANCES = 3;

const SEVERITY_RANK: Record<UnusualSeverity, number> = {
  highly_unusual: 0,
  unusual: 1,
  slightly_unusual: 2,
};

interface Period {
  from: string;
  to: string;
}

@Injectable()
export class HighlightsService {
  constructor(
    private readonly insightsService: InsightsService,
    private readonly unusualActivityService: UnusualActivityService,
    private readonly organisationsService: OrganisationsService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * Only what stood out over the range: the Unusual activity summary, and
   * plain notes where core work, activity or focus time moved a lot from
   * the member's own average over the periods just before.
   */
  async getHighlights(
    organisationId: string,
    callerUserId: string,
    targetMembershipId: string | undefined,
    from: string,
    to: string,
  ): Promise<MemberHighlights> {
    // Visibility and the range are checked here, before anything is read.
    const { caller, target } = await this.insightsService.getViewableMembership(
      organisationId,
      callerUserId,
      targetMembershipId,
    );
    this.insightsService.dayKeysBetween(from, to);

    const [unusual, defaults, activityStatus] = await Promise.all([
      this.unusualActivityService.getUnusualActivity(
        organisationId,
        callerUserId,
        targetMembershipId,
        from,
        to,
      ),
      this.organisationsService.getInsightsDefaults(organisationId),
      this.insightsService.activityStatusFor(organisationId, caller, target),
    ]);

    const severities = Object.keys(
      unusual.affectedSeconds,
    ) as UnusualSeverity[];
    const total = (seconds: Record<UnusualSeverity, number>) =>
      severities.reduce((sum, severity) => sum + seconds[severity], 0);
    const counts = Object.fromEntries(
      severities.map((severity) => [
        severity,
        unusual.instances.filter((instance) => instance.severity === severity)
          .length,
      ]),
    ) as Record<UnusualSeverity, number>;

    return {
      membershipId: target.id,
      timezone: defaults.timezone,
      activityStatus,
      checkedThrough: unusual.checkedThrough,
      unusualActivity: {
        counts,
        affectedSeconds: total(unusual.affectedSeconds),
        previousAffectedSeconds: total(unusual.previousPeriod.affectedSeconds),
        // Most serious first, then the longest.
        topInstances: [...unusual.instances]
          .sort(
            (a, b) =>
              SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
              b.durationSeconds - a.durationSeconds,
          )
          .slice(0, TOP_INSTANCES),
      },
      behaviourChanges: await this.behaviourChanges(
        organisationId,
        target,
        { from, to: unusual.checkedThrough, selectedTo: to },
        activityStatus,
        defaults,
      ),
    };
  }

  /**
   * The range against the `COMPARISON_PERIODS` periods of the same length
   * just before it (a week → the 3 weeks before). Only finished days count,
   * so a half-finished day never reads as a drop; while the range runs into
   * today, the same days of each earlier period are used (Mon–Thu against
   * Mon–Thu), so weekends don't skew the comparison.
   */
  private async behaviourChanges(
    organisationId: string,
    target: Membership,
    range: { from: string; to: string | null; selectedTo: string },
    activityStatus: ActivityStatus,
    defaults: Awaited<ReturnType<OrganisationsService['getInsightsDefaults']>>,
  ): Promise<MemberHighlights['behaviourChanges']> {
    // A member who may not see their own activity doesn't see what's
    // read off it either, core work included (as on Performance).
    if (range.to === null || activityStatus === 'hidden') {
      return { comparedWith: null, periodDays: 0, checkedDays: 0, changes: [] };
    }
    const current: Period = { from: range.from, to: range.to };
    const periodDays = keysBetween(range.from, range.selectedTo).length;
    const checkedDays = keysBetween(current.from, current.to).length;
    const previous: Period[] = Array.from(
      { length: COMPARISON_PERIODS },
      (_, index) => {
        const from = addDaysToKey(current.from, -periodDays * (index + 1));
        return { from, to: addDaysToKey(from, checkedDays - 1) };
      },
    );

    const boundsOf = (period: Period): DayBounds[] =>
      keysBetween(period.from, period.to).map((date) => ({
        date,
        start: startOfDayInZone(date, defaults.timezone),
        end: startOfDayInZone(addDaysToKey(date, 1), defaults.timezone),
      }));
    const earliest = boundsOf(previous[previous.length - 1])[0].start;
    const currentDays = boundsOf(current);
    const window = await this.timeEntriesService.timelineWindow(
      organisationId,
      target.id,
      earliest,
      currentDays[currentDays.length - 1].end,
    );
    // Only while recording, as on Performance.
    const samples = activityStatus === 'recorded' ? window.samples : [];
    const now = new Date();
    const todayKey = dateKeyInZone(now, defaults.timezone);

    const figuresOf = async (period: Period): Promise<PeriodFigures> => {
      const days = boundsOf(period);
      const performance = computeMemberPerformance({
        days,
        timeline: buildTimelineDays(
          days,
          window.entries,
          window.pausesByEntry,
          samples,
          now,
        ),
        samples,
        expectedWorkDays: target.expectedWorkDays ?? defaults.expectedWorkDays,
        hoursPerDay: defaults.hoursPerDay,
        todayKey,
      });
      const workTime = await this.insightsService.workTimeClassificationFor(
        organisationId,
        target,
        defaults.appUrlTracking,
        activityStatus,
        days,
      );
      return {
        coreWorkShare:
          workTime.status === 'available'
            ? workTime.coreSeconds /
              (workTime.coreSeconds +
                workTime.nonCoreSeconds +
                workTime.unclassifiedSeconds)
            : null,
        activityPercentage: performance.activity?.percentage ?? null,
        focusSeconds: performance.focus?.totalSeconds ?? null,
      };
    };

    const [currentFigures, ...previousFigures] = await Promise.all(
      [current, ...previous].map(figuresOf),
    );
    return {
      comparedWith: {
        from: previous[previous.length - 1].from,
        to: previous[0].to,
        periods: COMPARISON_PERIODS,
      },
      periodDays,
      checkedDays,
      changes: findBehaviourChanges(currentFigures, previousFigures),
    };
  }
}

function keysBetween(from: string, to: string): string[] {
  const keys: string[] = [];
  for (let key = from; key <= to; key = addDaysToKey(key, 1)) keys.push(key);
  return keys;
}
