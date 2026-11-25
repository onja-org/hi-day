import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { SAMPLE_INTERVAL_SECONDS } from '../../app-events/services/app-events.service';
import {
  appEventSampleAtSql,
  appEventSamplesJoinSql,
  runLookbackStart,
} from '../../common/app-event-samples.util';
import { calendarWeekAt, dateKeyInZone } from '../../common/calendar-week.util';
import { getManagerScopeTeamIds } from '../../common/manager-scope.util';
import { attributeProjectSeconds } from '../../common/project-attribution.util';
import {
  groupPausesByEntry,
  unionActiveSeconds,
} from '../../common/time-entry-union.util';
import { AppEvent } from '../../database/entities/app-event.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Team } from '../../database/entities/team.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { UrlSession } from '../../database/entities/url-session.entity';
import { MembershipsService } from '../../members/services/memberships.service';
import { OrganisationsService } from '../../organisations/services/organisations.service';
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

export interface TeamTime {
  teamId: string;
  teamName: string;
  seconds: number;
}

export interface TeamDashboardSummary {
  memberCount: number;
  workedThisWeekSeconds: number;
  /** vs. last week, same elapsed span — same convention as DashboardSummary. */
  workedThisWeekDeltaSeconds: number;
  projectsWorkedThisWeek: number;
  projectsWorkedDelta: number;
  /** Desc by seconds worked this week, aggregated across every scoped member. */
  projectsThisWeek: DashboardProjectTime[];
  /** Desc by seconds worked this week. */
  members: TeamMemberStatus[];
  /** Capped to RECENT_ACTIVITY_MEMBER_LIMIT members, busiest today first. */
  recentActivity: TeamMemberScreenshots[];
  /** Combined app + browser-domain usage this week across every scoped
   * member — desc by seconds, capped to APPS_AND_SITES_LIMIT. */
  appsAndSites: TeamAppOrSiteUsage[];
  /** Each visible team's members' time this week — every team for an
   * admin, only the managed ones for a manager — desc by seconds. Someone
   * in two teams counts towards both, so these can add up to more than
   * workedThisWeekSeconds. */
  teamsThisWeek: TeamTime[];
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
    projectsThisWeek: [],
    members: [],
    recentActivity: [],
    appsAndSites: [],
    teamsThisWeek: [],
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
    @InjectRepository(AppEvent)
    private readonly appEvents: Repository<AppEvent>,
    @InjectRepository(UrlSession)
    private readonly urlSessions: Repository<UrlSession>,
    private readonly membershipsService: MembershipsService,
    private readonly organisationsService: OrganisationsService,
    private readonly screenshotsService: ScreenshotsService,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
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
    // Same calendar as DashboardService, or a member's own week and their
    // team's week would start at different moments.
    const { weekStartsOn, timezone } =
      await this.organisationsService.getWeekCalendar(organisationId);
    const { weekStart, weekEnd, lastWeekStart, todayKey } = calendarWeekAt(
      now,
      timezone,
      weekStartsOn,
    );
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

    const pausesByEntry = await this.getPausesFor(
      membershipIds,
      lastWeekStart,
      weekEnd,
    );

    // Each member's hours are the *union* of their entries, not the sum: a
    // Membership may track on several Devices at once, and shared wall-clock
    // time counts once (ADR-0022) — the same figures their own dashboard
    // shows. Different people's time does add up, so the team's totals are
    // the sum of those per-member unions.
    const thisWeekByMember = groupByMember(thisWeekEntries);
    const memberTodaySeconds = new Map<string, number>();
    const memberWeekSeconds = new Map<string, number>();
    const projectSeconds = new Map<string, DashboardProjectTime>();
    let workedThisWeekSeconds = 0;

    for (const [membershipId, entries] of thisWeekByMember) {
      const weekSeconds = unionActiveSeconds(entries, pausesByEntry, now);
      memberWeekSeconds.set(membershipId, weekSeconds);
      workedThisWeekSeconds += weekSeconds;
      memberTodaySeconds.set(
        membershipId,
        unionActiveSeconds(
          entries.filter(
            (entry) => dateKeyInZone(entry.startedAt, timezone) === todayKey,
          ),
          pausesByEntry,
          now,
        ),
      );

      // Attributed within each member, then added across members: two of
      // one person's Devices on different Projects at once credit the shared
      // stretch to one of them, so the Projects never total more than the
      // hours above them (ADR-0022, as on the personal dashboard).
      const attribution = attributeProjectSeconds(entries, pausesByEntry, now);
      for (const entry of entries) {
        if (entry.projectId === null || !entry.project) continue;
        if (!projectSeconds.has(entry.projectId)) {
          projectSeconds.set(entry.projectId, {
            projectId: entry.projectId,
            projectName: entry.project.name,
            projectColour: entry.project.colour,
            seconds: 0,
          });
        }
      }
      for (const [projectId, seconds] of attribution) {
        const total = projectSeconds.get(projectId);
        if (total) total.seconds += seconds;
      }
    }

    let workedLastWeekSameSpanSeconds = 0;
    for (const entries of groupByMember(lastWeekSameSpanEntries).values()) {
      workedLastWeekSameSpanSeconds += unionActiveSeconds(
        entries,
        pausesByEntry,
        now,
      );
    }
    const lastWeekProjectIds = new Set(
      lastWeekSameSpanEntries.flatMap((entry) =>
        entry.projectId === null ? [] : [entry.projectId],
      ),
    );

    const runningByMembershipId = new Map(
      runningEntries.map((entry) => [entry.membershipId, entry]),
    );

    const members: TeamMemberStatus[] = scopedMembers
      .map((member) => {
        const running = runningByMembershipId.get(member.id);
        return {
          membershipId: member.id,
          name: member.name,
          email: member.email,
          isWorking: running !== undefined,
          currentProjectName: running?.project?.name ?? null,
          workedTodaySeconds: memberTodaySeconds.get(member.id) ?? 0,
          workedThisWeekSeconds: memberWeekSeconds.get(member.id) ?? 0,
        };
      })
      .sort((a, b) => b.workedThisWeekSeconds - a.workedThisWeekSeconds);

    const [recentActivity, appsAndSites, teamsThisWeek] = await Promise.all([
      this.getRecentActivity(organisationId, callerUserId, members),
      this.getAppsAndSites(membershipIds, weekStart, weekEnd),
      this.getTeamsThisWeek(organisationId, callerUserId, memberWeekSeconds),
    ]);

    return {
      memberCount: scopedMembers.length,
      workedThisWeekSeconds,
      workedThisWeekDeltaSeconds:
        workedThisWeekSeconds - workedLastWeekSameSpanSeconds,
      projectsWorkedThisWeek: projectSeconds.size,
      projectsWorkedDelta: projectSeconds.size - lastWeekProjectIds.size,
      projectsThisWeek: [...projectSeconds.values()].sort(
        (a, b) => b.seconds - a.seconds,
      ),
      members,
      recentActivity,
      appsAndSites,
      teamsThisWeek,
    };
  }

  /**
   * Team visibility uses the same rule as the member scope above
   * (getManagerScopeTeamIds): an admin sees every team, a manager only the
   * teams they manage. `memberWeekSeconds` only holds scoped, active
   * members, so a team's total never includes anyone the caller can't see.
   */
  private async getTeamsThisWeek(
    organisationId: string,
    callerUserId: string,
    memberWeekSeconds: Map<string, number>,
  ): Promise<TeamTime[]> {
    const caller = await this.memberships.findOne({
      where: {
        userId: callerUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { teamMemberships: true },
    });
    if (!caller) return [];

    const teams = await this.teams.find({
      where: { organisationId },
      relations: { teamMemberships: true },
    });
    const managedTeamIds = new Set(getManagerScopeTeamIds(caller));
    const visibleTeams =
      caller.role === MembershipRole.ADMIN
        ? teams
        : teams.filter((team) => managedTeamIds.has(team.id));

    return visibleTeams
      .map((team) => ({
        teamId: team.id,
        teamName: team.name,
        seconds: team.teamMemberships.reduce(
          (sum, teamMembership) =>
            sum + (memberWeekSeconds.get(teamMembership.membershipId) ?? 0),
          0,
        ),
      }))
      .sort((a, b) => b.seconds - a.seconds);
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
        // Only the newest few are read and signed, not the whole day.
        const screenshots =
          await this.screenshotsService.getLatestScreenshotsForMembership(
            organisationId,
            callerUserId,
            member.membershipId,
            RECENT_ACTIVITY_SCREENSHOTS_PER_MEMBER,
          );
        return {
          membershipId: member.membershipId,
          name: member.name,
          screenshots,
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
   *
   * App events are counted per *sample*, not per row: a row can stand for a
   * run of samples (see common/app-event-samples.util.ts), expanded in SQL
   * so a run straddling `from`/`to` counts only its samples inside.
   */
  private async getAppsAndSites(
    membershipIds: string[],
    from: Date,
    to: Date,
  ): Promise<TeamAppOrSiteUsage[]> {
    const [appEventCounts, urlSessionTotals] = await Promise.all([
      // Raw SQL rather than the query builder: TypeORM quotes a joined
      // set-returning function as if it were a table name. $2 only lets the
      // (membershipId, sampledAt) index narrow the scan, looking back far
      // enough to catch a run reaching into the window; the per-sample
      // bound ($3..$4) is what actually decides.
      this.appEvents.query<{ appName: string; count: string }[]>(
        `SELECT a."appName" AS "appName", COUNT(*)::text AS "count"
         FROM "app_events" a
         ${appEventSamplesJoinSql('a')}
         WHERE a."membershipId" = ANY($1)
           AND a."sampledAt" BETWEEN $2 AND $4
           AND ${appEventSampleAtSql('a')} BETWEEN $3 AND $4
         GROUP BY a."appName"`,
        [membershipIds, runLookbackStart(from), from, to],
      ),
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

  /**
   * The pauses of every scoped member's entries started in [from, to],
   * found by joining to their entries rather than listing entry ids: one
   * bind parameter per entry ran past Postgres's 65,535 limit for a large
   * organisation's fortnight of entries. A few pauses from entries outside
   * the dashboard's windows may come back too; nothing looks them up.
   */
  private async getPausesFor(
    membershipIds: string[],
    from: Date,
    to: Date,
  ): Promise<Map<string, TimeEntryPause[]>> {
    const pauses = await this.timeEntryPauses
      .createQueryBuilder('pause')
      .innerJoin('pause.timeEntry', 'entry')
      .where('entry.membershipId IN (:...membershipIds)', { membershipIds })
      .andWhere('entry.startedAt BETWEEN :from AND :to', { from, to })
      .getMany();
    return groupPausesByEntry(pauses);
  }
}

function groupByMember(entries: TimeEntry[]): Map<string, TimeEntry[]> {
  const byMember = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    byMember.set(entry.membershipId, [
      ...(byMember.get(entry.membershipId) ?? []),
      entry,
    ]);
  }
  return byMember;
}
