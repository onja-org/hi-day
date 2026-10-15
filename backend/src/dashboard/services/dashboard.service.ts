import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { localDateKey } from '../../common/local-date-key.util';
import { attributeProjectSeconds } from '../../common/project-attribution.util';
import {
  buildPauseStates,
  computeActiveSeconds,
  PauseState,
} from '../../common/time-entry-active-seconds.util';
import {
  groupPausesByEntry,
  unionActiveSeconds,
} from '../../common/time-entry-union.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import type { WeekStart } from '../../organisations/company-profile';
import { OrganisationsService } from '../../organisations/services/organisations.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

export interface DashboardWeekDay {
  /** YYYY-MM-DD, in the server's local timezone — not the Organisation's,
   * unlike the timesheet. A known divergence. */
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
  /** Week-to-date from the Organisation's week-start day, not a full
   * 7-day total. */
  workedThisWeekSeconds: number;
  /** vs. last week, same elapsed span (week start through "now minus 7 days"). */
  workedThisWeekDeltaSeconds: number;
  projectsWorkedThisWeek: number;
  projectsWorkedDelta: number;
  /** Always 7 entries from the Organisation's week-start day, zero-filled
   * for days with no entries (including days later this week). */
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
    const weekStart = this.startOfWeek(
      now,
      await this.organisationsService.getWeekStart(organisationId),
    );

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

    const todayKey = localDateKey(now);
    const byDay = this.zeroFilledWeek(weekStart);
    let workedTodaySeconds = 0;
    let workedThisWeekSeconds = 0;
    const projectSeconds = new Map<string, DashboardProjectTime>();
    const projectSecondsToday = new Map<string, DashboardProjectTime>();

    // Totals are the *union* of the person's entries, not their sum: a
    // Membership may track on several Devices at once, and shared wall-clock
    // time must count once or reported hours stop being bounded by the clock
    // (ADR-0022). Per-entry seconds are still used for the per-project and
    // per-day breakdowns' grouping, then unioned within each group.
    const pausesByEntry = await this.getPausesFor([
      ...thisWeekEntries,
      ...yesterdaySameSpanEntries,
    ]);
    const unionOf = (entries: TimeEntry[]): number =>
      unionActiveSeconds(entries, pausesByEntry, now);

    const entriesByDay = new Map<string, TimeEntry[]>();
    const entriesByProject = new Map<string, TimeEntry[]>();
    const todayEntriesByProject = new Map<string, TimeEntry[]>();

    for (const entry of thisWeekEntries) {
      const seconds = computeActiveSeconds(entry, pauseStates, now);

      const key = localDateKey(entry.startedAt);
      entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
      // A Project breakdown is only about entries that have one.
      if (entry.projectId === null || !entry.project) continue;
      entriesByProject.set(entry.projectId, [
        ...(entriesByProject.get(entry.projectId) ?? []),
        entry,
      ]);
      // Running entries count too, measured to `now` below: leaving them
      // out reported a Project as untouched while a desktop filled it.
      if (key === todayKey) {
        todayEntriesByProject.set(entry.projectId, [
          ...(todayEntriesByProject.get(entry.projectId) ?? []),
          entry,
        ]);
      }

      if (!projectSeconds.has(entry.projectId)) {
        projectSeconds.set(entry.projectId, {
          projectId: entry.projectId,
          projectName: entry.project.name,
          projectColour: entry.project.colour,
          seconds: 0,
        });
      }
      if (!projectSecondsToday.has(entry.projectId) && key === todayKey) {
        projectSecondsToday.set(entry.projectId, {
          projectId: entry.projectId,
          projectName: entry.project.name,
          projectColour: entry.project.colour,
          seconds: 0,
        });
      }
      void seconds;
    }

    workedThisWeekSeconds = unionOf(thisWeekEntries);
    workedTodaySeconds = unionOf(entriesByDay.get(todayKey) ?? []);
    for (const day of byDay) {
      day.seconds = unionOf(entriesByDay.get(day.date) ?? []);
    }
    // Attributed rather than unioned per Project: two Devices may run
    // different Projects at once, and unioning each Project's own entries
    // would let both claim the shared stretch, so the breakdown would exceed
    // the total it sits under (ADR-0022). Crediting each shared second to one
    // Project keeps the parts summing to the whole.
    const projectAttribution = attributeProjectSeconds(
      thisWeekEntries,
      pausesByEntry,
      now,
    );
    const todayAttribution = attributeProjectSeconds(
      [...todayEntriesByProject.values()].flat(),
      pausesByEntry,
      now,
    );
    for (const [projectId, total] of projectSeconds) {
      total.seconds = projectAttribution.get(projectId) ?? 0;
    }
    for (const [projectId, total] of projectSecondsToday) {
      total.seconds = todayAttribution.get(projectId) ?? 0;
    }

    const workedYesterdaySameSpanSeconds = unionOf(yesterdaySameSpanEntries);

    let workedLastWeekSameSpanSeconds = 0;
    const lastWeekProjectIds = new Set<string>();
    for (const entry of lastWeekSameSpanEntries) {
      workedLastWeekSameSpanSeconds += computeActiveSeconds(
        entry,
        pauseStates,
        now,
      );
      if (entry.projectId !== null) lastWeekProjectIds.add(entry.projectId);
    }

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
    return buildPauseStates(pauses);
  }

  /**
   * The same pause rows, ungrouped — the union needs each pause's shape, not
   * the netted total `PauseState` carries.
   */
  private async getPausesFor(
    entries: TimeEntry[],
  ): Promise<Map<string, TimeEntryPause[]>> {
    const timeEntryIds = entries.map((entry) => entry.id);
    if (timeEntryIds.length === 0) return new Map();

    return groupPausesByEntry(
      await this.timeEntryPauses.find({
        where: { timeEntryId: In(timeEntryIds) },
      }),
    );
  }

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private startOfWeek(date: Date, weekStartsOn: WeekStart): Date {
    const start = this.startOfDay(date);
    // getDay() is 0 for Sunday, which is six days into a Monday-start week.
    const offset =
      weekStartsOn === 'monday' ? (start.getDay() + 6) % 7 : start.getDay();
    start.setDate(start.getDate() - offset);
    return start;
  }

  private zeroFilledWeek(weekStart: Date): DashboardWeekDay[] {
    return Array.from({ length: WEEK_DAYS }, (_, index) => ({
      date: localDateKey(new Date(weekStart.getTime() + index * DAY_MS)),
      seconds: 0,
    }));
  }
}
