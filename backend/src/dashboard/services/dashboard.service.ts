import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { OrganisationsService } from '../../organisations/services/organisations.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

interface PauseState {
  pausedAt: Date | null;
  pausedSeconds: number;
}

const NO_PAUSE_STATE: PauseState = { pausedAt: null, pausedSeconds: 0 };

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

    const [thisWeekEntries, yesterdaySameSpanEntries, lastWeekSameSpanEntries] =
      await Promise.all([
        this.timeEntries.find({
          where: {
            membershipId: membership.id,
            startedAt: Between(
              weekStart,
              new Date(weekStart.getTime() + WEEK_DAYS * DAY_MS),
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
      ...thisWeekEntries,
      ...yesterdaySameSpanEntries,
      ...lastWeekSameSpanEntries,
    ]);

    const todayKey = this.dateKey(now);
    const byDay = this.zeroFilledWeek(weekStart);
    let workedTodaySeconds = 0;
    let workedThisWeekSeconds = 0;
    const projectSeconds = new Map<string, DashboardProjectTime>();

    for (const entry of thisWeekEntries) {
      const seconds = this.activeSeconds(entry, pauseStates, now);
      workedThisWeekSeconds += seconds;

      const key = this.dateKey(entry.startedAt);
      const day = byDay.find((candidate) => candidate.date === key);
      if (day) {
        day.seconds += seconds;
      }
      if (key === todayKey) {
        workedTodaySeconds += seconds;
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
      (total, entry) => total + this.activeSeconds(entry, pauseStates, now),
      0,
    );

    let workedLastWeekSameSpanSeconds = 0;
    const lastWeekProjectIds = new Set<string>();
    for (const entry of lastWeekSameSpanEntries) {
      workedLastWeekSameSpanSeconds += this.activeSeconds(
        entry,
        pauseStates,
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

  /** Active seconds for one entry, capped at "now" (or the instant it was
   * paused) and net of every closed pause span — same formula the frontend
   * uses to freeze a running timer's display (`useRunningTimer`). */
  private activeSeconds(
    entry: TimeEntry,
    pauseStates: Map<string, PauseState>,
    now: Date,
  ): number {
    const pauseState = pauseStates.get(entry.id) ?? NO_PAUSE_STATE;
    const effectiveEnd = pauseState.pausedAt ?? entry.endedAt ?? now;
    const grossSeconds =
      (effectiveEnd.getTime() - entry.startedAt.getTime()) / 1000;
    return Math.max(0, Math.round(grossSeconds - pauseState.pausedSeconds));
  }

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

    const byEntry = new Map<string, TimeEntryPause[]>();
    for (const pause of pauses) {
      const forEntry = byEntry.get(pause.timeEntryId) ?? [];
      forEntry.push(pause);
      byEntry.set(pause.timeEntryId, forEntry);
    }

    const states = new Map<string, PauseState>();
    for (const [timeEntryId, spans] of byEntry) {
      const open = spans.find((span) => span.resumedAt === null);
      const closedSeconds = spans
        .filter((span) => span.resumedAt !== null)
        .reduce(
          (total, span) =>
            total +
            (span.resumedAt!.getTime() - span.pausedAt.getTime()) / 1000,
          0,
        );
      states.set(timeEntryId, {
        pausedAt: open?.pausedAt ?? null,
        pausedSeconds: Math.round(closedSeconds),
      });
    }
    return states;
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
