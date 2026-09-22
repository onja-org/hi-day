import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { SAMPLE_INTERVAL_SECONDS } from '../../app-events/services/app-events.service';
import { localDateKey } from '../../common/local-date-key.util';
import {
  buildPauseStates,
  computeActiveSeconds,
  PauseState,
} from '../../common/time-entry-active-seconds.util';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { AppEvent } from '../../database/entities/app-event.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { MembershipsService } from '../../members/services/memberships.service';
import type { ScreenshotSummaryItem } from '../../screenshots/services/screenshots.service';
import { ScreenshotsService } from '../../screenshots/services/screenshots.service';
import type { DashboardProjectTime } from './dashboard.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const MS_PER_SECOND = 1000;

/**
 * How many members' screenshots get embedded in the team summary — keeps
 * the number of presigned-URL generations (one Wasabi call per screenshot)
 * bounded regardless of org size, same reasoning as
 * ScreenshotsService.deleteExpired's own batch cap.
 */
const RECENT_ACTIVITY_MEMBER_LIMIT = 4;
const RECENT_ACTIVITY_SCREENSHOTS_PER_MEMBER = 3;

/** Top N combined app/site rows — a dashboard preview, not the full report
 * (see the Apps/URLs activity pages for the unabridged breakdown). */
const APPS_AND_SITES_LIMIT = 5;

export interface TeamMemberStatus {
  membershipId: string;
  name: string | null;
  email: string;
  isWorking: boolean;
  currentProjectName: string | null;
  workedTodaySeconds: number;
  workedThisWeekSeconds: number;
  /** Average ActivitySample.activePercentage for this member today/this
   * week; null if no samples exist yet — render "—", never a fabricated 0%. */
  todayActivityPercentage: number | null;
  weekActivityPercentage: number | null;
}

export interface TeamMemberScreenshots {
  membershipId: string;
  name: string | null;
  /** Most recent first. */
  screenshots: ScreenshotSummaryItem[];
}

export interface TeamAppOrSiteUsage {
  /** A native app's name (e.g. "Slack") or, for browser time, the visited
   * domain (e.g. "docs.google.com") — the app and its domains are peer
   * entries in the same ranked list, same as the individual Apps/URLs
   * activity pages track them as separate sources. */
  label: string;
  seconds: number;
}

export interface TeamDashboardSummary {
  memberCount: number;
  workedThisWeekSeconds: number;
  /** vs. last week, same elapsed span — same convention as DashboardSummary. */
  workedThisWeekDeltaSeconds: number;
  projectsWorkedThisWeek: number;
  projectsWorkedDelta: number;
  /** Average ActivitySample.activePercentage across every scoped member this
   * week; null if no samples exist yet. */
  weeklyActivityPercentage: number | null;
  weeklyActivityDeltaPercentage: number | null;
  /** Desc by seconds worked this week, aggregated across every scoped member. */
  projectsThisWeek: DashboardProjectTime[];
  /** Desc by seconds worked this week. */
  members: TeamMemberStatus[];
  /** Capped to RECENT_ACTIVITY_MEMBER_LIMIT members, busiest today first. */
  recentActivity: TeamMemberScreenshots[];
  /** Combined app + browser-domain usage this week across every scoped
   * member — desc by seconds, capped to APPS_AND_SITES_LIMIT. */
  appsAndSites: TeamAppOrSiteUsage[];
}

// A function, not a module-level constant — Nest services are singletons,
// so a shared object here would hand every teamless-manager caller the same
// array references (`projectsThisWeek`, `members`) that the populated path
// below builds fresh each call.
function emptySummary(): TeamDashboardSummary {
  return {
    memberCount: 0,
    workedThisWeekSeconds: 0,
    workedThisWeekDeltaSeconds: 0,
    projectsWorkedThisWeek: 0,
    projectsWorkedDelta: 0,
    weeklyActivityPercentage: null,
    weeklyActivityDeltaPercentage: null,
    projectsThisWeek: [],
    members: [],
    recentActivity: [],
    appsAndSites: [],
  };
}

/**
 * The org-wide counterpart to DashboardService — "All" tab data for
 * admins/managers. Scoping (admin sees everyone, manager sees only the
 * team(s) they manage, a teamless manager sees nobody) is delegated
 * entirely to MembershipsService.listActiveForOrganisation rather than
 * re-derived here, so there's exactly one place that implements the
 * manager-scope rule.
 */
@Injectable()
export class TeamDashboardService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
    @InjectRepository(TimeEntryPause)
    private readonly timeEntryPauses: Repository<TimeEntryPause>,
    @InjectRepository(ActivitySample)
    private readonly activitySamples: Repository<ActivitySample>,
    @InjectRepository(AppEvent)
    private readonly appEvents: Repository<AppEvent>,
    @InjectRepository(UrlSession)
    private readonly urlSessions: Repository<UrlSession>,
    private readonly membershipsService: MembershipsService,
    private readonly screenshotsService: ScreenshotsService,
  ) {}

  async getSummary(
    organisationId: string,
    callerUserId: string,
  ): Promise<TeamDashboardSummary> {
    const scopedMembers =
      await this.membershipsService.listActiveForOrganisation(
        organisationId,
        callerUserId,
      );

    if (scopedMembers.length === 0) {
      // A teamless (or non-managing) manager — same "empty, not everyone"
      // rule as listActiveForOrganisation itself.
      return emptySummary();
    }

    const membershipIds = scopedMembers.map((member) => member.id);
    const now = new Date();
    const weekStart = this.startOfWeek(now);
    const weekEnd = new Date(weekStart.getTime() + WEEK_DAYS * DAY_MS);
    const lastWeekStart = new Date(weekStart.getTime() - WEEK_DAYS * DAY_MS);
    const lastWeekSameSpanEnd = new Date(now.getTime() - WEEK_DAYS * DAY_MS);

    const [thisWeekEntries, lastWeekSameSpanEntries, runningEntries] =
      await Promise.all([
        this.timeEntries.find({
          where: {
            membershipId: In(membershipIds),
            startedAt: Between(weekStart, weekEnd),
          },
          relations: { project: true },
          order: { startedAt: 'ASC' },
        }),
        this.timeEntries.find({
          where: {
            membershipId: In(membershipIds),
            startedAt: Between(lastWeekStart, lastWeekSameSpanEnd),
          },
        }),
        this.timeEntries.find({
          where: { membershipId: In(membershipIds), endedAt: IsNull() },
          relations: { project: true },
        }),
      ]);

    const pauseStates = await this.getPauseStatesFor([
      ...thisWeekEntries,
      ...lastWeekSameSpanEntries,
    ]);

    const todayKey = localDateKey(now);
    const projectSeconds = new Map<string, DashboardProjectTime>();
    const memberTodaySeconds = new Map<string, number>();
    const memberWeekSeconds = new Map<string, number>();
    let workedThisWeekSeconds = 0;

    for (const entry of thisWeekEntries) {
      const seconds = computeActiveSeconds(entry, pauseStates, now);
      workedThisWeekSeconds += seconds;
      memberWeekSeconds.set(
        entry.membershipId,
        (memberWeekSeconds.get(entry.membershipId) ?? 0) + seconds,
      );
      if (localDateKey(entry.startedAt) === todayKey) {
        memberTodaySeconds.set(
          entry.membershipId,
          (memberTodaySeconds.get(entry.membershipId) ?? 0) + seconds,
        );
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

    const runningByMembershipId = new Map(
      runningEntries.map((entry) => [entry.membershipId, entry]),
    );

    const [thisWeekSamples, lastWeekSamples] = await Promise.all([
      this.activitySamples.find({
        where: {
          membershipId: In(membershipIds),
          periodStart: Between(weekStart, weekEnd),
        },
      }),
      this.activitySamples.find({
        where: {
          membershipId: In(membershipIds),
          periodStart: Between(lastWeekStart, lastWeekSameSpanEnd),
        },
      }),
    ]);
    const weeklyActivityPercentage =
      this.averageActivePercentage(thisWeekSamples);
    const lastWeekActivityPercentage =
      this.averageActivePercentage(lastWeekSamples);

    const members: TeamMemberStatus[] = scopedMembers
      .map((member) => {
        const running = runningByMembershipId.get(member.id);
        const memberSamples = thisWeekSamples.filter(
          (sample) => sample.membershipId === member.id,
        );
        const memberTodaySamples = memberSamples.filter(
          (sample) => localDateKey(sample.periodStart) === todayKey,
        );
        return {
          membershipId: member.id,
          name: member.name,
          email: member.email,
          isWorking: running !== undefined,
          currentProjectName: running ? running.project.name : null,
          workedTodaySeconds: memberTodaySeconds.get(member.id) ?? 0,
          workedThisWeekSeconds: memberWeekSeconds.get(member.id) ?? 0,
          todayActivityPercentage:
            this.averageActivePercentage(memberTodaySamples),
          weekActivityPercentage: this.averageActivePercentage(memberSamples),
        };
      })
      .sort((a, b) => b.workedThisWeekSeconds - a.workedThisWeekSeconds);

    const [recentActivity, appsAndSites] = await Promise.all([
      this.getRecentActivity(organisationId, callerUserId, members),
      this.getAppsAndSites(membershipIds, weekStart, weekEnd),
    ]);

    return {
      memberCount: scopedMembers.length,
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
      projectsThisWeek: [...projectSeconds.values()].sort(
        (a, b) => b.seconds - a.seconds,
      ),
      members,
      recentActivity,
      appsAndSites,
    };
  }

  private async getRecentActivity(
    organisationId: string,
    callerUserId: string,
    members: TeamMemberStatus[],
  ): Promise<TeamMemberScreenshots[]> {
    const candidates = [...members]
      .filter((member) => member.isWorking || member.workedTodaySeconds > 0)
      .sort((a, b) => b.workedTodaySeconds - a.workedTodaySeconds)
      .slice(0, RECENT_ACTIVITY_MEMBER_LIMIT);

    return Promise.all(
      candidates.map(async (member) => {
        const screenshots =
          await this.screenshotsService.getScreenshotsForMembership(
            organisationId,
            callerUserId,
            member.membershipId,
          );
        return {
          membershipId: member.membershipId,
          name: member.name,
          screenshots: screenshots
            .slice(-RECENT_ACTIVITY_SCREENSHOTS_PER_MEMBER)
            .reverse(),
        };
      }),
    );
  }

  /**
   * Combines two different sources into one ranked list: native-app
   * foreground time (AppEvent, sample-counted per app) and browser tab time
   * (UrlSession, summed by domain from its own tracked activeMs) — a
   * simpler merge than the desktop agent's own per-window attribution, but
   * enough for a dashboard preview.
   *
   * Aggregated in the database (grouped counts/sums), not by loading every
   * raw sample/session row into memory — AppEvent alone is one row per ~5s
   * per person, which would be hundreds of thousands of rows a week for a
   * mid-sized org. Same reasoning as ProjectsService.getTaskCounts.
   */
  private async getAppsAndSites(
    membershipIds: string[],
    from: Date,
    to: Date,
  ): Promise<TeamAppOrSiteUsage[]> {
    const [appEventCounts, urlSessionTotals] = await Promise.all([
      this.appEvents
        .createQueryBuilder('appEvent')
        .select('appEvent.appName', 'appName')
        .addSelect('COUNT(*)', 'count')
        .where('appEvent.membershipId IN (:...membershipIds)', {
          membershipIds,
        })
        .andWhere('appEvent.sampledAt BETWEEN :from AND :to', { from, to })
        .groupBy('appEvent.appName')
        .getRawMany<{ appName: string; count: string }>(),
      this.urlSessions
        .createQueryBuilder('urlSession')
        .select('urlSession.host', 'host')
        .addSelect('SUM(urlSession.activeMs)', 'totalActiveMs')
        .where('urlSession.membershipId IN (:...membershipIds)', {
          membershipIds,
        })
        .andWhere('urlSession.startedAt BETWEEN :from AND :to', { from, to })
        // Empty host/url means a private session — stripped client-side
        // before it ever left the device (see UrlSession's own doc comment).
        .andWhere("urlSession.host != ''")
        .groupBy('urlSession.host')
        .getRawMany<{ host: string; totalActiveMs: string }>(),
    ]);

    const secondsByLabel = new Map<string, number>();
    for (const row of appEventCounts) {
      secondsByLabel.set(
        row.appName,
        Number(row.count) * SAMPLE_INTERVAL_SECONDS,
      );
    }
    for (const row of urlSessionTotals) {
      secondsByLabel.set(
        row.host,
        Math.round(Number(row.totalActiveMs) / MS_PER_SECOND),
      );
    }

    return [...secondsByLabel.entries()]
      .map(([label, seconds]) => ({ label, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, APPS_AND_SITES_LIMIT);
  }

  private averageActivePercentage(samples: ActivitySample[]): number | null {
    if (samples.length === 0) {
      return null;
    }
    const total = samples.reduce(
      (sum, sample) => sum + sample.activePercentage,
      0,
    );
    return Math.round(total / samples.length);
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
}
