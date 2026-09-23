import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { localDateKey } from '../../common/local-date-key.util';
import {
  buildPauseStates,
  computeActiveSeconds,
  PauseState,
} from '../../common/time-entry-active-seconds.util';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { ProjectColour } from '../../database/entities/project-colour.enum';
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

    const todayKey = localDateKey(now);
    const byDay = this.zeroFilledWeek(weekStart);
    let workedTodaySeconds = 0;
    let workedThisWeekSeconds = 0;
    const projectSeconds = new Map<string, DashboardProjectTime>();
    const projectSecondsToday = new Map<string, DashboardProjectTime>();

    for (const entry of thisWeekEntries) {
      const seconds = computeActiveSeconds(entry, pauseStates, now);
      workedThisWeekSeconds += seconds;

      const key = localDateKey(entry.startedAt);
      const day = byDay.find((candidate) => candidate.date === key);
      if (day) {
        day.seconds += seconds;
      }
      if (key === todayKey) {
        workedTodaySeconds += seconds;

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
      (total, entry) => total + computeActiveSeconds(entry, pauseStates, now),
      0,
    );

    let workedLastWeekSameSpanSeconds = 0;
    const lastWeekProjectIds = new Set<string>();
    for (const entry of lastWeekSameSpanEntries) {
      workedLastWeekSameSpanSeconds += computeActiveSeconds(
        entry,
        pauseStates,
        now,
      );
      lastWeekProjectIds.add(entry.projectId);
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

  private zeroFilledWeek(weekStart: Date): DashboardWeekDay[] {
    return Array.from({ length: WEEK_DAYS }, (_, index) => ({
      date: localDateKey(new Date(weekStart.getTime() + index * DAY_MS)),
      seconds: 0,
    }));
  }
}
