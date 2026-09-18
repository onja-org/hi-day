import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import type { PauseState } from '../../common/time-entry-active-seconds.util';
import {
  NO_PAUSE_STATE,
  activeSeconds,
  resolvePauseStates,
} from '../../common/time-entry-active-seconds.util';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { Rollup } from '../../database/entities/rollup.entity';
import { RollupPeriodType } from '../../database/entities/rollup-period-type.enum';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { OrganisationsService } from '../../organisations/services/organisations.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

export interface DashboardWeekDay {
  /** YYYY-MM-DD, in the server's local timezone — matches the frontend's
   * own Sunday-start week convention (`getTimesheetDateRange`). */
  date: string;
  seconds: number;
}

export interface DashboardProjectTime {
  projectId: string;
  projectName: string;
  projectColour: ProjectColour;
  seconds: number;
}

export interface DashboardSummary {
  workedTodaySeconds: number;
  /** vs. yesterday, same time-of-day — a fair "so far today" comparison. */
  workedTodayDeltaSeconds: number;
  /** Week-to-date (Sunday through now), not a full 7-day total. */
  workedThisWeekSeconds: number;
  /** vs. last week, same elapsed span (Sunday through "now minus 7 days"). */
  workedThisWeekDeltaSeconds: number;
  projectsWorkedThisWeek: number;
  projectsWorkedDelta: number;
  /** Average ActivitySample.activePercentage this week; null if no samples
   * exist yet — render as "—", never a fabricated 0%. */
  weeklyActivityPercentage: number | null;
  weeklyActivityDeltaPercentage: number | null;
  /** Always 7 entries, Sunday-Saturday, zero-filled for days with no
   * entries (including days later this week, which naturally have none). */
  thisWeekByDay: DashboardWeekDay[];
  /** Desc by seconds worked this week. */
  projectsThisWeek: DashboardProjectTime[];
  /**
   * Today's per-project totals from *completed* entries only — deliberately
   * excludes whatever's still running, unlike `workedTodaySeconds`/
   * `projectsThisWeek` (which cap a running entry's seconds at "now"). A
   * caller showing a live-ticking timer must add its own elapsed time on
   * top of this instead of trusting a snapshot that's already stale by the
   * time it renders; keeping the open entry out entirely avoids double-
   * counting it once from here and again from the live tick.
   */
  projectsToday: DashboardProjectTime[];
  /** Admin-configurable, default 8 — informational only, never enforced. */
  workingHoursPerDayTarget: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
    @InjectRepository(TimeEntryPause)
    private readonly timeEntryPauses: Repository<TimeEntryPause>,
    @InjectRepository(Rollup)
    private readonly rollups: Repository<Rollup>,
    @InjectRepository(ActivitySample)
    private readonly activitySamples: Repository<ActivitySample>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    private readonly organisationsService: OrganisationsService,
  ) {}

  async getSummary(
    organisationId: string,
    userId: string,
  ): Promise<DashboardSummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const now = new Date();
    const weekStart = this.startOfWeek(now);
    const todayStart = this.startOfDay(now);

    // This week splits into two very differently-shaped reads: every day
    // *before* today already has a finalized Rollup row (fast, pre-summed,
    // no pause-netting needed at read time), while today is still
    // accumulating and has no such row yet — it's computed live from raw
    // entries, exactly as the whole week used to be before rollups
    // existed. `yesterdaySameSpan`/`lastWeekSameSpan` below stay raw
    // queries regardless: a same-time-of-day partial-day comparison has no
    // whole-day rollup that could answer it.
    const [
      completedDayRollups,
      todayEntries,
      yesterdaySameSpanEntries,
      lastWeekSameSpanEntries,
    ] = await Promise.all([
      this.rollups.find({
        where: {
          membershipId: membership.id,
          periodType: RollupPeriodType.DAY,
          periodStart: Between(weekStart, new Date(todayStart.getTime() - 1)),
        },
        relations: { project: true },
      }),
      this.timeEntries.find({
        where: {
          membershipId: membership.id,
          startedAt: Between(
            todayStart,
            new Date(todayStart.getTime() + DAY_MS - 1),
          ),
        },
        relations: { project: true },
        order: { startedAt: 'ASC' },
      }),
      this.timeEntries.find({
        where: {
          membershipId: membership.id,
          startedAt: Between(
            new Date(this.startOfDay(now).getTime() - DAY_MS),
            new Date(now.getTime() - DAY_MS),
          ),
        },
      }),
      this.timeEntries.find({
        where: {
          membershipId: membership.id,
          startedAt: Between(
            new Date(weekStart.getTime() - WEEK_DAYS * DAY_MS),
            new Date(now.getTime() - WEEK_DAYS * DAY_MS),
          ),
        },
      }),
    ]);

    const pauseStates = await this.getPauseStatesFor([
      ...todayEntries,
      ...yesterdaySameSpanEntries,
      ...lastWeekSameSpanEntries,
    ]);

    const todayKey = this.dateKey(now);
    const byDay = this.zeroFilledWeek(weekStart);
    let workedTodaySeconds = 0;
    let workedThisWeekSeconds = 0;
    const projectSeconds = new Map<string, DashboardProjectTime>();
    const projectSecondsToday = new Map<string, DashboardProjectTime>();

    // Every day before today: already-netted totals straight from Rollup,
    // no per-entry pause resolution needed.
    for (const rollup of completedDayRollups) {
      workedThisWeekSeconds += rollup.workedSeconds;

      const key = this.dateKey(rollup.periodStart);
      const day = byDay.find((candidate) => candidate.date === key);
      if (day) {
        day.seconds += rollup.workedSeconds;
      }

      const existingProject = projectSeconds.get(rollup.projectId);
      if (existingProject) {
        existingProject.seconds += rollup.workedSeconds;
      } else {
        projectSeconds.set(rollup.projectId, {
          projectId: rollup.projectId,
          projectName: rollup.project.name,
          projectColour: rollup.project.colour,
          seconds: rollup.workedSeconds,
        });
      }
    }

    // Today: live, same formula the running-timer display uses — there is
    // no completed-day rollup for today to read instead.
    for (const entry of todayEntries) {
      const seconds = activeSeconds(
        entry,
        pauseStates.get(entry.id) ?? NO_PAUSE_STATE,
        now,
      );
      workedThisWeekSeconds += seconds;
      workedTodaySeconds += seconds;

      const day = byDay.find((candidate) => candidate.date === todayKey);
      if (day) {
        day.seconds += seconds;
      }

      if (entry.endedAt) {
        const existingToday = projectSecondsToday.get(entry.projectId);
        if (existingToday) {
          existingToday.seconds += seconds;
        } else {
          projectSecondsToday.set(entry.projectId, {
            projectId: entry.projectId,
            projectName: entry.project.name,
            projectColour: entry.project.colour,
            seconds,
          });
        }
      }

      const existingProject = projectSeconds.get(entry.projectId);
      if (existingProject) {
        existingProject.seconds += seconds;
      } else {
        projectSeconds.set(entry.projectId, {
          projectId: entry.projectId,
          projectName: entry.project.name,
          projectColour: entry.project.colour,
          seconds,
        });
      }
    }

    const workedYesterdaySameSpanSeconds = yesterdaySameSpanEntries.reduce(
      (total, entry) =>
        total +
        activeSeconds(entry, pauseStates.get(entry.id) ?? NO_PAUSE_STATE, now),
      0,
    );

    let workedLastWeekSameSpanSeconds = 0;
    const lastWeekProjectIds = new Set<string>();
    for (const entry of lastWeekSameSpanEntries) {
      workedLastWeekSameSpanSeconds += activeSeconds(
        entry,
        pauseStates.get(entry.id) ?? NO_PAUSE_STATE,
        now,
      );
      lastWeekProjectIds.add(entry.projectId);
    }

    const weeklyActivityPercentage = await this.getAverageActivity(
      membership.id,
      weekStart,
      new Date(weekStart.getTime() + WEEK_DAYS * DAY_MS),
    );
    const lastWeekActivityPercentage = await this.getAverageActivity(
      membership.id,
      new Date(weekStart.getTime() - WEEK_DAYS * DAY_MS),
      new Date(now.getTime() - WEEK_DAYS * DAY_MS),
    );
    const workingHoursPolicy =
      await this.organisationsService.getWorkingHoursPolicy(organisationId);

    return {
      workedTodaySeconds,
      workedTodayDeltaSeconds:
        workedTodaySeconds - workedYesterdaySameSpanSeconds,
      workedThisWeekSeconds,
      workedThisWeekDeltaSeconds:
        workedThisWeekSeconds - workedLastWeekSameSpanSeconds,
      projectsWorkedThisWeek: projectSeconds.size,
      projectsWorkedDelta: projectSeconds.size - lastWeekProjectIds.size,
      weeklyActivityPercentage,
      weeklyActivityDeltaPercentage:
        weeklyActivityPercentage !== null && lastWeekActivityPercentage !== null
          ? weeklyActivityPercentage - lastWeekActivityPercentage
          : null,
      thisWeekByDay: byDay,
      projectsThisWeek: [...projectSeconds.values()].sort(
        (a, b) => b.seconds - a.seconds,
      ),
      projectsToday: [...projectSecondsToday.values()].sort(
        (a, b) => b.seconds - a.seconds,
      ),
      workingHoursPerDayTarget: workingHoursPolicy.hoursPerDay,
    };
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

  private async getAverageActivity(
    membershipId: string,
    from: Date,
    to: Date,
  ): Promise<number | null> {
    const samples = await this.activitySamples.find({
      where: { membershipId, periodStart: Between(from, to) },
    });
    if (samples.length === 0) {
      return null;
    }
    const total = samples.reduce(
      (sum, sample) => sum + sample.activePercentage,
      0,
    );
    return Math.round(total / samples.length);
  }

  /** Shared with `TimeEntriesService`/`RollupService` — see
   * `time-entry-active-seconds.util.ts` for why this can't be computed
   * independently in each service without risking drift. */
  private async getPauseStatesFor(
    entries: TimeEntry[],
  ): Promise<Map<string, PauseState>> {
    const timeEntryIds = entries.map((entry) => entry.id);
    if (timeEntryIds.length === 0) {
      return new Map();
    }

    const pauses = await this.timeEntryPauses.find({
      where: { timeEntryId: In(timeEntryIds) },
    });

    return resolvePauseStates(pauses);
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private startOfWeek(date: Date): Date {
    const start = this.startOfDay(date);
    start.setDate(start.getDate() - start.getDay());
    return start;
  }

  /** Local calendar date as YYYY-MM-DD — `toISOString` would shift the date
   * near midnight for any server timezone with a non-zero UTC offset. */
  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private zeroFilledWeek(weekStart: Date): DashboardWeekDay[] {
    return Array.from({ length: WEEK_DAYS }, (_, index) => ({
      date: this.dateKey(new Date(weekStart.getTime() + index * DAY_MS)),
      seconds: 0,
    }));
  }
}
