import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Between,
  DataSource,
  EntityManager,
  Equal,
  type FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { CaptureCleanupService } from '../../captures/services/capture-cleanup.service';
import type { PrunedCaptures } from '../../captures/services/capture-cleanup.service';
import { TimeEntryCoverageWindow } from '../../common/time-entry-coverage.util';
import { unionActiveSeconds } from '../../common/time-entry-union.util';
import { Membership } from '../../database/entities/membership.entity';
import { getManagerScopeTeamIds } from '../../common/manager-scope.util';
import {
  DEFAULT_ALLOWED_APPS,
  isTimerSourceAllowed,
} from '../../organisations/allowed-apps';
import type { AllowedApps } from '../../organisations/allowed-apps';
import { Organisation } from '../../database/entities/organisation.entity';
import { DEFAULT_TIMESHEET_MODIFY_TIME } from '../../organisations/timesheet-settings';
import type { TimesheetModifyTime } from '../../organisations/timesheet-settings';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import {
  isTimeTrackingRole,
  ProjectMembershipRole,
} from '../../database/entities/project-membership-role.enum';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { Task } from '../../database/entities/task.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { ActivitySample } from '../../database/entities/activity-sample.entity';
import { Device } from '../../database/entities/device.entity';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import { TimeEntryType } from '../../database/entities/time-entry-type.enum';
import { hasTeamProjectAccess } from '../../projects/team-project-access.util';
import { CreateManualTimeEntryDto } from '../dto/create-manual-time-entry.dto';
import { DeleteTimeEntryDto } from '../dto/delete-time-entry.dto';
import { SplitTimeEntryDto } from '../dto/split-time-entry.dto';
import { UpdateTimeEntryDto } from '../dto/update-time-entry.dto';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

// A personal timesheet listing, not a report — plenty for one person's own
// history at a glance. Revisit with real pagination if/when this becomes a
// manager-facing, multi-person view.
const LIST_LIMIT = 200;

// Caps splitRunningEntriesAcrossDayBoundary's hourly scan, same reasoning as
// ScreenshotsService.deleteExpired's own RETENTION_CLEANUP_BATCH_SIZE — this
// query isn't paired with a membershipId like everything else here, so it's
// the one query in this service that scans across every org at once.
const DAY_BOUNDARY_SPLIT_BATCH_SIZE = 200;

/**
 * How long a Device may go unheard before its running timer is treated as
 * abandoned. Generous on purpose: the entry is ended at `lastSeenAt`
 * whatever the wait, so a longer grace costs no accuracy and buys immunity
 * from a dropped wifi connection closing a timer somebody is still using.
 */
const ABANDONED_DEVICE_GRACE_MS = 30 * 60 * 1000;

const ABANDONED_ENTRY_BATCH_SIZE = 200;

export interface TimeEntrySummary {
  id: string;
  membershipId: string;
  projectId: string;
  taskId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  source: TimeEntrySource;
  deviceId: string | null;
  /**
   * Non-null while the entry has an open `TimeEntryPause` span — the instant
   * that pause began. Clients freeze the elapsed-time display at
   * `pausedAt - startedAt - pausedSeconds` rather than continuing to tick.
   */
  pausedAt: Date | null;
  /** Total seconds paused so far, across every *closed* pause span. */
  pausedSeconds: number;
}

export interface PauseSpan {
  pausedAt: Date;
  /** null while this particular span is still open (currently paused). */
  resumedAt: Date | null;
}

export interface TimeEntryListItem extends TimeEntrySummary {
  projectName: string;
  projectColour: ProjectColour;
  taskName: string | null;
  /** Whose hours these are, for naming them in confirmations. `memberName`
   * is null when the User never set one — fall back to the email. */
  memberName: string | null;
  memberEmail: string | null;
  /** What kind of time this is — see `TimeEntryType`. */
  type: TimeEntryType;
  /**
   * Keyboard/mouse activity across the entry, 0-100, or null when no
   * activity sample covers it — an agent that never reported, or time
   * tracked before this existed. Weighted by how much of each 10-minute
   * sample actually falls inside the entry, so a sample half outside it
   * counts half.
   */
  activePercentage: number | null;
  /** null while the entry is still running (endedAt is null). */
  durationSeconds: number | null;
  /** Whether the *viewer* can edit and split this entry — admin only. */
  canEdit: boolean;
  /** Whether the viewer can delete it — their own always, anyone's if an
   * admin. Wider than `canEdit` on purpose; see `canDeleteEntry`. */
  canDelete: boolean;
  /**
   * Every pause span on this entry, oldest first — the historical timesheet
   * view surfaces these (when a person paused and resumed) rather than only
   * the summed `pausedSeconds`. `TimeEntrySummary`'s live-timer paths
   * (start/stop/switch/current) don't carry this — only the list view needs
   * pause history, not just live pause state.
   */
  pauses: PauseSpan[];
}

/**
 * Which entries a new span must not overlap. `tracked` means "nothing else
 * from this Device"; `manual` means "nothing else at all for this person".
 */
type OverlapScope = 'tracked' | 'manual';

export interface CurrentTimeEntry {
  /** The web's own entry, never a Device's — what its controls act on. */
  entry: TimeEntrySummary | null;
  /** A Device's running entry. Reported so the web can pin its own timer to
   * the same Project; never controlled from there. */
  elsewhere: TimeEntrySummary | null;
  /**
   * The server's own clock at the moment of the read — both the web
   * console and the desktop agent tick elapsed time from this instead of
   * their own local clocks, so a skewed device clock can't make the two
   * surfaces disagree about how long a timer has been running.
   */
  now: Date;
  /**
   * The person's worked seconds across every Device currently tracking,
   * counting shared wall-clock time once. Clients display this rather than
   * deriving elapsed time from `entry.startedAt`, so a second Device shows
   * the total already accrued instead of starting from zero (ADR-0022).
   */
  workedSeconds: number;
}

interface ValidatedStart {
  membership: Membership;
  task: Task | null;
}

interface PauseState {
  pausedAt: Date | null;
  pausedSeconds: number;
  spans: PauseSpan[];
}

const NO_PAUSE_STATE: PauseState = {
  pausedAt: null,
  pausedSeconds: 0,
  spans: [],
};

@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
    @InjectRepository(TimeEntryPause)
    private readonly timeEntryPauses: Repository<TimeEntryPause>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Organisation)
    private readonly organisations: Repository<Organisation>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
    @InjectRepository(ProjectTeam)
    private readonly projectTeams: Repository<ProjectTeam>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(ActivitySample)
    private readonly activitySamples: Repository<ActivitySample>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly captureCleanup: CaptureCleanupService,
  ) {}

  /**
   * Starts a new timer. Rejects with a 409 (carrying the entry already
   * running, if any) rather than silently stopping it — auto-stopping a
   * timer running on another device would mutate hours the person didn't
   * necessarily know were still ticking, which cuts against a trust-first
   * product. Use `switchTo` for the explicit "stop that one, start this
   * one" action.
   */

  /**
   * The open Time entry for one Device, not for the person.
   *
   * A Membership may have several timers running at once — one per Device —
   * so "the running timer" is only meaningful once a Device is named. The
   * web has no Device and passes null, which is its own scope: `deviceId IS
   * NULL` matches only web-started entries, never a desktop's.
   *
   * Superseded ADR-0006's one-timer-per-Membership rule; see
   * docs/adr/0022 for why parallel timers do not inflate reported hours.
   */
  private runningForDevice(
    membershipId: string,
    deviceId: string | null,
  ): FindOptionsWhere<TimeEntry> {
    return {
      membershipId,
      deviceId: deviceId === null ? IsNull() : deviceId,
      endedAt: IsNull(),
    };
  }

  /**
   * Every timer the person has running, across all their Devices.
   *
   * The web controls the account rather than a machine: its stop means "end
   * my tracking", which with parallel Devices is no longer a single entry.
   * Each is closed individually so per-Device history stays intact.
   */
  async stopAll(
    organisationId: string,
    userId: string,
    endedAt?: Date,
  ): Promise<TimeEntrySummary[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.find({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });
    if (running.length === 0) {
      throw new NotFoundException('No timer is currently running.');
    }

    const resolvedEndedAt = endedAt ?? new Date();
    const stopped: TimeEntrySummary[] = [];
    for (const entry of running) {
      this.assertValidRange(entry.startedAt, resolvedEndedAt);
      entry.endedAt = resolvedEndedAt;
      const saved = await this.timeEntries.save(entry);
      await this.closeOpenPause(
        this.timeEntryPauses,
        saved.id,
        resolvedEndedAt,
      );
      stopped.push(await this.toSummary(saved));
    }

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'time_entry.stopped_all',
        organisationId,
        actorUserId: userId,
        metadata: { timeEntryIds: running.map((entry) => entry.id) },
      });
    });

    return stopped;
  }

  /**
   * What the web shows: `entry` is the timer it started, so its controls
   * never reach into a machine the person is not looking at. A tracking
   * Device comes back as `elsewhere` instead.
   *
   * `workedSeconds` stays the union across every open entry, so a second
   * machine starting at 10:00 shows the hour the first already accrued.
   */
  async currentForAccount(
    organisationId: string,
    userId: string,
  ): Promise<CurrentTimeEntry> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.find({
      where: { membershipId: membership.id, endedAt: IsNull() },
      order: { startedAt: 'ASC' },
    });
    const own = running.find((entry) => entry.deviceId === null) ?? null;
    const onADevice = running.find((entry) => entry.deviceId !== null) ?? null;

    return {
      entry: own ? await this.toSummary(own) : null,
      elsewhere: onADevice ? await this.toSummary(onADevice) : null,
      now: new Date(),
      workedSeconds: await this.unionWorkedSeconds(running),
    };
  }

  /** Union of the active time across these entries; see time-entry-union.util. */
  private async unionWorkedSeconds(entries: TimeEntry[]): Promise<number> {
    if (entries.length === 0) return 0;
    const pauses = await this.timeEntryPauses.find({
      where: { timeEntryId: In(entries.map((entry) => entry.id)) },
    });
    const byEntry = new Map<string, TimeEntryPause[]>();
    for (const pause of pauses) {
      byEntry.set(pause.timeEntryId, [
        ...(byEntry.get(pause.timeEntryId) ?? []),
        pause,
      ]);
    }
    return unionActiveSeconds(entries, byEntry, new Date());
  }

  /**
   * Pauses or resumes every Device at once — the web's controls are
   * account-level, matching its stop.
   */
  async setPausedForAccount(
    organisationId: string,
    userId: string,
    paused: boolean,
  ): Promise<TimeEntrySummary[]> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.find({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });
    if (running.length === 0) {
      throw new NotFoundException('No timer is currently running.');
    }

    const now = new Date();
    const summaries: TimeEntrySummary[] = [];
    for (const entry of running) {
      const open = await this.timeEntryPauses.findOne({
        where: { timeEntryId: entry.id, resumedAt: IsNull() },
      });
      if (paused && !open) {
        await this.timeEntryPauses.save(
          this.timeEntryPauses.create({
            organisationId,
            timeEntryId: entry.id,
            pausedAt: now,
            resumedAt: null,
          }),
        );
      } else if (!paused && open) {
        await this.closeOpenPause(this.timeEntryPauses, entry.id, now);
      }
      summaries.push(await this.toSummary(entry));
    }

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: paused ? 'time_entry.paused_all' : 'time_entry.resumed_all',
        organisationId,
        actorUserId: userId,
        metadata: { timeEntryIds: running.map((entry) => entry.id) },
      });
    });

    return summaries;
  }

  async start(
    organisationId: string,
    userId: string,
    projectId: string,
    taskId: string | undefined,
    source: TimeEntrySource,
    deviceId: string | null,
    /** A device that was offline when start was pressed reports when that was. */
    requestedStartedAt?: Date,
  ): Promise<TimeEntrySummary> {
    const { membership, task } = await this.validateStart(
      organisationId,
      userId,
      projectId,
      taskId,
    );
    await this.assertAppAllowed(membership, organisationId, source);

    // Another Device may be tracking anything, the same Project or a
    // different one. Only the Project totals made a different one a problem,
    // and attribution now settles those: a stretch tracked twice is credited
    // to one Project, so two of them cannot both claim it (ADR-0022).
    // Deliberately not auto-stopping the other device — ADR-0006's reasoning,
    // that silently ending a timer on a machine the person is not looking at
    // mutates hours feeding payroll, still holds.
    const elsewhere = await this.timeEntries.find({
      where: { membershipId: membership.id, endedAt: IsNull() },
      relations: { device: true },
    });

    // One timer per Device, and the web counts as one — matching the
    // index's NULLS NOT DISTINCT, so two browsers share a single web timer.
    const onThisSurface =
      deviceId === null
        ? elsewhere.find((entry) => entry.deviceId === null)
        : elsewhere.find((entry) => entry.deviceId === deviceId);
    if (onThisSurface) {
      throw new ConflictException({
        message:
          deviceId === null
            ? 'A timer is already running on the web.'
            : 'A timer is already running on this device.',
        runningEntry: await this.toSummary(onThisSurface),
      });
    }

    // The web may track alongside a Device, but only the same Project:
    // "laptop says X, browser says Y" is a split the person cannot see,
    // unlike two machines they picked up one at a time. Devices keep their
    // freedom to differ from each other (ADR-0022).
    const deviceProjectIds = new Set(
      elsewhere
        .filter((entry) => entry.deviceId !== null)
        .map((entry) => entry.projectId),
    );
    if (
      deviceId === null &&
      deviceProjectIds.size > 0 &&
      !deviceProjectIds.has(projectId)
    ) {
      const mismatch = elsewhere.find((entry) => entry.deviceId !== null)!;
      throw new ConflictException({
        message:
          'Your device is tracking a different project. Start that same project here, or stop it there first.',
        runningEntry: await this.toSummary(mismatch),
      });
    }

    const startedAt = await this.resolveStartedAt(
      membership.id,
      deviceId,
      requestedStartedAt,
    );
    const entry = this.timeEntries.create({
      organisationId,
      membershipId: membership.id,
      projectId,
      taskId: task?.id ?? null,
      startedAt,
      endedAt: null,
      source,
      deviceId,
    });
    const saved = await this.timeEntries.save(entry);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'time_entry.started',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: saved.id,
          projectId,
          taskId: task?.id ?? null,
        },
      });
    });

    return await this.toSummary(saved);
  }

  /**
   * Stops the caller's running timer. `endedAt`, when given, backdates the
   * stop instead of using "now" — the desktop agent's idle-discard flow
   * uses this to end the entry at when the person actually went idle,
   * rather than when the agent noticed and the person responded.
   */
  async stop(
    organisationId: string,
    userId: string,
    deviceId: string | null,
    endedAt?: Date,
    /** `pause` ends an entry too, and records itself as such. */
    options: { action?: 'time_entry.stopped' | 'time_entry.paused' } = {},
  ): Promise<TimeEntrySummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.findOne({
      where: this.runningForDevice(membership.id, deviceId),
    });
    if (!running) {
      throw new NotFoundException(
        'No timer is currently running on this device.',
      );
    }

    const resolvedEndedAt = endedAt ?? new Date();
    this.assertValidRange(running.startedAt, resolvedEndedAt);

    running.endedAt = resolvedEndedAt;
    const saved = await this.timeEntries.save(running);
    // Never leave a dangling open pause span on a stopped entry — close it
    // at the same instant the entry itself ends, rather than requiring the
    // caller to resume first.
    await this.closeOpenPause(this.timeEntryPauses, saved.id, resolvedEndedAt);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: options.action ?? 'time_entry.stopped',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: saved.id,
          ...(endedAt
            ? {
                reason: 'idle',
                discardedSeconds: Math.round(
                  (Date.now() - resolvedEndedAt.getTime()) / 1000,
                ),
              }
            : {}),
        },
      });
    });

    return await this.toSummary(saved);
  }

  /**
   * Atomically stops whatever's currently running (if anything) and starts
   * a new timer, in one transaction — the explicit alternative to the 409
   * `start` throws, so there's no client-side gap between the stop and the
   * next start.
   */
  async switchTo(
    organisationId: string,
    userId: string,
    projectId: string,
    taskId: string | undefined,
    source: TimeEntrySource,
    deviceId: string | null,
  ): Promise<TimeEntrySummary> {
    const { membership, task } = await this.validateStart(
      organisationId,
      userId,
      projectId,
      taskId,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      // Scoped to this Device: switching on one machine stops that machine's
      // timer, never another's. Leaving two Devices on different Projects is
      // a supported state — attribution credits any shared stretch to one of
      // them (ADR-0022) — so nothing here needs to guard against it.
      const running = await manager.findOne(TimeEntry, {
        where: this.runningForDevice(membership.id, deviceId),
      });

      if (running) {
        const stoppedAt = new Date();
        running.endedAt = stoppedAt;
        await manager.save(running);
        await this.closeOpenPause(
          manager.getRepository(TimeEntryPause),
          running.id,
          stoppedAt,
        );
        await this.auditLogService.record(manager, {
          action: 'time_entry.stopped',
          organisationId,
          actorUserId: userId,
          metadata: { timeEntryId: running.id },
        });
      }

      const entry = manager.create(TimeEntry, {
        organisationId,
        membershipId: membership.id,
        projectId,
        taskId: task?.id ?? null,
        startedAt: new Date(),
        endedAt: null,
        source,
        deviceId,
      });
      const savedEntry = await manager.save(entry);

      await this.auditLogService.record(manager, {
        action: 'time_entry.started',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: savedEntry.id,
          projectId,
          taskId: task?.id ?? null,
          switchedFromTimeEntryId: running?.id ?? null,
        },
      });

      return savedEntry;
    });

    return await this.toSummary(saved);
  }

  async current(
    organisationId: string,
    userId: string,
    deviceId: string | null,
  ): Promise<CurrentTimeEntry> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const [running, allRunning] = await Promise.all([
      this.timeEntries.findOne({
        where: this.runningForDevice(membership.id, deviceId),
      }),
      this.timeEntries.find({
        where: { membershipId: membership.id, endedAt: IsNull() },
      }),
    ]);

    const other = allRunning.find((entry) => entry.id !== running?.id) ?? null;

    return {
      entry: running ? await this.toSummary(running) : null,
      // Where else the person is tracking. Reported, never controlled:
      // this Device's stop ends this Device's timer only.
      elsewhere: other ? await this.toSummary(other) : null,
      now: new Date(),
      // Account-wide on purpose: this Device displays the person's total, so
      // a machine joining at 10:00 shows the hour another already accrued.
      workedSeconds: await this.unionWorkedSeconds(allRunning),
    };
  }

  /**
   * A timesheet: the caller's entries, or another member's for an
   * admin/manager, most recent first with Project/Task names resolved.
   * Viewing uses the same role gate as editing (`canEditEntry`).
   *
   * `from`/`to` filter `startedAt` inclusively. The frontend resolves what
   * "today" means in the viewer's timezone, so this stays timezone-naive.
   */
  async list(
    organisationId: string,
    userId: string,
    targetMembershipId?: string,
    from?: Date,
    to?: Date,
  ): Promise<TimeEntryListItem[]> {
    const membership = await this.getActiveMembership(organisationId, userId);

    let subjectMembershipId = membership.id;
    if (targetMembershipId && targetMembershipId !== membership.id) {
      // Role first, existence second: a member who can never read anyone
      // else's timesheet shouldn't learn from a 404-vs-403 whether a given
      // membership id exists.
      if (!ORG_WIDE_ROLES.includes(membership.role)) {
        throw new ForbiddenException(
          "Only an admin or manager can view another member's timesheet.",
        );
      }
      const target = await this.memberships.findOne({
        where: { id: targetMembershipId, organisationId },
      });
      if (!target) {
        throw new NotFoundException('Member not found.');
      }
      if (
        !(await this.canSeeMembership(membership, organisationId, target.id))
      ) {
        throw new ForbiddenException(
          'You can only view the timesheets of members on teams you manage.',
        );
      }
      subjectMembershipId = target.id;
    }

    const entries = await this.timeEntries.find({
      where: {
        membershipId: subjectMembershipId,
        ...(from && to
          ? { startedAt: Between(from, to) }
          : from
            ? { startedAt: MoreThanOrEqual(from) }
            : to
              ? { startedAt: LessThanOrEqual(to) }
              : {}),
      },
      // `membership.user` is loaded only for the member's display name, so
      // confirmations can say whose hours they are about to touch.
      relations: { project: true, task: true, membership: { user: true } },
      order: { startedAt: 'DESC' },
      take: LIST_LIMIT,
    });

    const pauseStates = await this.getPauseStatesFor(
      entries.map((entry) => entry.id),
    );
    const activity = await this.getActivityFor(subjectMembershipId, entries);
    const canModifyTime = await this.canModifyTime(membership, organisationId);
    return entries.map((entry) =>
      this.toListItem(
        entry,
        membership,
        pauseStates.get(entry.id) ?? NO_PAUSE_STATE,
        canModifyTime,
        activity.get(entry.id),
      ),
    );
  }

  /**
   * Every entry for one membership whose `[startedAt, endedAt)` interval
   * overlaps `[start, end)` — an attribution lookup (which project was
   * being timed at some instant), not a display listing. No pagination, no
   * relations, no pause-state resolution, unlike `list()`. Callers fetch
   * once per request and match many instants against the result in memory
   * via `findEntryCovering` (see `common/time-entry-coverage.util.ts`) —
   * never a query per instant.
   */
  async listCoveringWindow(
    organisationId: string,
    membershipId: string,
    start: Date,
    end: Date,
  ): Promise<TimeEntryCoverageWindow[]> {
    return this.timeEntries
      .createQueryBuilder('entry')
      .select([
        'entry.id',
        'entry.projectId',
        'entry.startedAt',
        'entry.endedAt',
      ])
      .where('entry.organisationId = :organisationId', { organisationId })
      .andWhere('entry.membershipId = :membershipId', { membershipId })
      .andWhere('entry.startedAt < :end', { end })
      .andWhere('(entry.endedAt IS NULL OR entry.endedAt > :start)', { start })
      .getMany();
  }

  /**
   * Keeps a running timer from silently spanning multiple calendar days —
   * without this, a timer left running overnight attributes its entire
   * elapsed time to whichever day it started, corrupting every per-day
   * aggregate (dashboard, timesheet). Runs hourly, same cadence as
   * `ScreenshotsService.deleteExpired`.
   *
   * Splits at the *Organisation's* midnight, not the server's. It used to
   * use the server's, and production runs UTC, so a team in EAT had its
   * days cut at 3am — every overnight timer produced an entry starting
   * 3:00 AM that nobody worked.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async splitRunningEntriesAcrossDayBoundary(): Promise<void> {
    // Before the split, never after: an entry whose Device has gone should
    // be closed where the Device was last heard from, and splitting it
    // first would leave the half after midnight starting later than that
    // instant and so impossible to close honestly.
    await this.closeEntriesFromDevicesThatWentAway();

    const now = new Date();
    // The widest possible boundary, so the query cannot miss an entry whose
    // own Organisation sits in a later timezone; each is then split against
    // its own.
    const earliestTodayStart = this.startOfDayInZone(now, 'UTC');

    const running = await this.timeEntries.find({
      where: { endedAt: IsNull(), startedAt: LessThan(earliestTodayStart) },
      take: DAY_BOUNDARY_SPLIT_BATCH_SIZE,
    });

    const zonesThisBatch = new Map<string, string>();
    for (const entry of running) {
      const zone = await this.organisationTimezone(
        entry.organisationId,
        zonesThisBatch,
      );
      await this.splitAcrossDayBoundaries(
        entry.id,
        this.startOfDayInZone(now, zone),
        zone,
      );
    }
  }

  /**
   * Ends a timer at the last time its Device was heard from.
   *
   * Shutdown requests are best-effort, so a timer may remain open
   * if the machine stops before the request completes. Day-boundary
   * splits keep carrying it forward, potentially billing unworked time.
   *
   * Since the agent heartbeats every 60 seconds, `lastSeenAt` marks
   * the last known active time.
   *
   * Only applies to Devices; browser timers have no heartbeat.
   */
  async closeEntriesFromDevicesThatWentAway(now = new Date()): Promise<void> {
    const goneSince = new Date(now.getTime() - ABANDONED_DEVICE_GRACE_MS);

    const abandoned = await this.timeEntries
      .createQueryBuilder('entry')
      .innerJoin(Device, 'device', 'device.id = entry.deviceId')
      .where('entry.endedAt IS NULL')
      .andWhere('entry.deviceId IS NOT NULL')
      .andWhere('device.lastSeenAt IS NOT NULL')
      .andWhere('device.lastSeenAt < :goneSince', { goneSince })
      .select(['entry.id', 'entry.startedAt'])
      .addSelect('device.lastSeenAt', 'device_lastSeenAt')
      .take(ABANDONED_ENTRY_BATCH_SIZE)
      .getRawAndEntities();

    for (const [index, entry] of abandoned.entities.entries()) {
      const lastSeenAt = new Date(
        (abandoned.raw[index] as { device_lastSeenAt: string | Date })
          .device_lastSeenAt,
      );

      // An entry starting after its Device's last heartbeat spans time the
      // machine was not alive. Day-boundary splits create these by carrying
      // abandoned timers past midnight. Since they contain no worked time,
      // they are deleted rather than closed to avoid empty records.
      if (lastSeenAt.getTime() <= entry.startedAt.getTime()) {
        await this.removeEntryHoldingNoWork(entry, lastSeenAt);
        continue;
      }

      await this.dataSource.transaction(async (manager) => {
        // Re-read inside the transaction: the agent may have come back and
        // stopped it between the query above and here.
        const fresh = await manager.findOne(TimeEntry, {
          where: { id: entry.id },
        });
        if (!fresh || fresh.endedAt !== null) return;

        fresh.endedAt = lastSeenAt;
        await manager.save(fresh);
        await this.closeOpenPause(
          manager.getRepository(TimeEntryPause),
          fresh.id,
          lastSeenAt,
        );

        await this.auditLogService.record(manager, {
          action: 'time_entry.closed_device_offline',
          organisationId: fresh.organisationId,
          metadata: {
            timeEntryId: fresh.id,
            deviceId: fresh.deviceId,
            endedAt: lastSeenAt.toISOString(),
          },
        });
      });

      this.logger.log(
        `[abandoned] entry=${entry.id} ended at ${lastSeenAt.toISOString()} — ` +
          `its device had not reported since then`,
      );
    }
  }

  /**
   * Deletes an entry created by splitting a timer past its Device's lifetime.
   * No worked time exists to preserve; associated pauses are deleted via the
   * foreign key, and no captures can reference an entry outside the Device's
   * runtime.
   */
  private async removeEntryHoldingNoWork(
    entry: TimeEntry,
    deviceLastSeenAt: Date,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const fresh = await manager.findOne(TimeEntry, {
        where: { id: entry.id },
      });
      if (!fresh || fresh.endedAt !== null) return;

      await this.auditLogService.record(manager, {
        action: 'time_entry.removed_device_offline',
        organisationId: fresh.organisationId,
        metadata: {
          timeEntryId: fresh.id,
          deviceId: fresh.deviceId,
          startedAt: fresh.startedAt.toISOString(),
          deviceLastSeenAt: deviceLastSeenAt.toISOString(),
        },
      });
      await manager.delete(TimeEntry, { id: fresh.id });
    });

    this.logger.log(
      `[abandoned] entry=${entry.id} removed — it began ${entry.startedAt.toISOString()}, ` +
        `after its device was last seen ${deviceLastSeenAt.toISOString()}, so it holds no worked time`,
    );
  }

  /**
   * `seen` memoises within one batch. Passed in rather than held on the
   * service, which is a singleton: a Map here would outlive every request
   * and keep serving a zone an admin had already changed.
   */
  private async organisationTimezone(
    organisationId: string,
    seen: Map<string, string>,
  ): Promise<string> {
    const cached = seen.get(organisationId);
    if (cached) return cached;
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    const settings = organisation?.settings as
      { timezone?: string } | undefined;
    // UTC is the value every Organisation was created with, and the right
    // answer when the row has gone.
    const zone = settings?.timezone ?? 'UTC';
    seen.set(organisationId, zone);
    return zone;
  }

  /**
   * Splits one entry, one calendar day at a time, until its `startedAt` is
   * within today — so a gap longer than one cron cycle (the server was
   * down, say) fully catches up in a single call rather than needing one
   * cron run per missed day. Each day's split is its own transaction (same
   * pattern as `switchTo`), re-reading the entry fresh each time in case it
   * was stopped manually in between.
   */
  private async splitAcrossDayBoundaries(
    entryId: string,
    todayStart: Date,
    zone: string,
  ): Promise<void> {
    for (;;) {
      const nextEntryId = await this.dataSource.transaction(async (manager) => {
        const entry = await manager.findOne(TimeEntry, {
          where: { id: entryId },
        });
        if (!entry || entry.endedAt !== null) {
          return null; // stopped manually, or already caught up
        }
        if (
          this.startOfDayInZone(entry.startedAt, zone).getTime() >=
          todayStart.getTime()
        ) {
          return null; // already within today
        }

        const boundary = this.startOfNextDayInZone(entry.startedAt, zone);
        if (boundary.getTime() <= entry.startedAt.getTime()) {
          // Should be unreachable — startOfNextDay always lands on the
          // day *after* startedAt's day — but guard anyway rather than
          // risk a zero/negative-duration entry.
          return null;
        }

        entry.endedAt = boundary;
        await manager.save(entry);

        const next = await manager.save(
          manager.create(TimeEntry, {
            organisationId: entry.organisationId,
            membershipId: entry.membershipId,
            projectId: entry.projectId,
            taskId: entry.taskId,
            startedAt: boundary,
            endedAt: null,
            source: entry.source,
            deviceId: entry.deviceId,
          }),
        );

        await this.auditLogService.record(manager, {
          action: 'time_entry.day_boundary_split',
          organisationId: entry.organisationId,
          metadata: {
            fromTimeEntryId: entry.id,
            toTimeEntryId: next.id,
            boundary: boundary.toISOString(),
          },
        });

        return next.id;
      });

      if (!nextEntryId) return;
      entryId = nextEntryId;
    }
  }

  /**
   * The instant a calendar day begins in `zone`.
   *
   * By correction, not arithmetic: the offset is the thing being solved
   * for, so it cannot simply be added. Re-reading the clock at a guess and
   * shifting by the difference converges in two passes, DST included.
   */
  private startOfDayInZone(at: Date, zone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(at);
    const get = (type: string): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const wanted = Date.UTC(get('year'), get('month') - 1, get('day'));

    let guess = wanted;
    for (let pass = 0; pass < 2; pass += 1) {
      guess += wanted - this.readClockAsUtc(new Date(guess), zone);
    }
    return new Date(guess);
  }

  /** The zone's wall clock read back as if it were UTC, so two can subtract. */
  private readClockAsUtc(at: Date, zone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const get = (type: string): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    // Midnight can come back as hour 24 under hourCycle h24.
    return Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second'),
    );
  }

  /** The instant the day after `at`'s own day begins, in `zone`. */
  private startOfNextDayInZone(at: Date, zone: string): Date {
    const dayStart = this.startOfDayInZone(at, zone);
    // A day is 23, 24 or 25 hours long, so step well past it and take that
    // day's own start rather than adding a fixed 24.
    return this.startOfDayInZone(
      new Date(dayStart.getTime() + 36 * 60 * 60 * 1000),
      zone,
    );
  }

  /**
   * Directly logs a completed span with an explicit start/end rather than
   * running a live timer. Admin-only — everyone else logs time by running a
   * timer, not by typing hours in (the gate lives in
   * `resolveManualEntryTarget`). `dto.membershipId` puts the span on someone
   * else's timesheet.
   */
  async createManual(
    organisationId: string,
    userId: string,
    projectId: string,
    dto: CreateManualTimeEntryDto,
  ): Promise<TimeEntrySummary> {
    const { membership, task } = await this.resolveManualEntryTarget(
      organisationId,
      userId,
      projectId,
      dto.taskId,
      dto.membershipId,
    );

    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);
    this.assertValidRange(startedAt, endedAt);
    // Editing has always refused an overlap; creating never did, so a span
    // could be typed that editing then would not let you keep.
    await this.assertNoOverlap(
      membership.id,
      null,
      null,
      startedAt,
      endedAt,
      'manual',
    );

    const entry = this.timeEntries.create({
      organisationId,
      membershipId: membership.id,
      projectId,
      taskId: task?.id ?? null,
      startedAt,
      endedAt,
      source: TimeEntrySource.MANUAL,
      type: TimeEntryType.MANUAL,
      deviceId: null,
    });
    const saved = await this.timeEntries.save(entry);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'time_entry.created_manually',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: saved.id,
          membershipId: membership.id,
          projectId,
          taskId: task?.id ?? null,
          startedAt,
          endedAt,
          // The report reads `metadata.reason` for every action; without
          // this, every `add` row in it was permanently blank.
          reason: dto.reason ?? null,
        },
      });
    });

    return await this.toSummary(saved);
  }

  /**
   * Edits a Time entry. Admin-only, anyone's including their own — see
   * `canEditEntry`.
   *
   * An unstopped entry (`endedAt IS NULL`, which a *paused* one also is)
   * can still have its Project, Task and start corrected. Only `endedAt` is
   * refused: setting it here would end the timer without emitting
   * `time_entry.stopped`, leaving no account of how it ended — use `stop`.
   *
   * Moving an unstopped entry to another Project takes the time already
   * accrued with it; nothing is split at the edit point (see `split`).
   *
   * Moving a boundary **deletes** the captures left outside the new span
   * unless another entry covers them (see `CaptureCleanupService`), so only
   * activity recorded during the entry as it now stands survives. The new
   * span must also not overlap another of this person's entries — one
   * moment can't belong to two of them.
   */
  async update(
    organisationId: string,
    userId: string,
    timeEntryId: string,
    dto: UpdateTimeEntryDto,
  ): Promise<TimeEntrySummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const entry = await this.timeEntries.findOne({
      where: { id: timeEntryId, organisationId },
    });
    if (!entry) {
      throw new NotFoundException('Time entry not found.');
    }
    if (
      !(await this.canEditEntry(membership, organisationId, entry.membershipId))
    ) {
      throw new ForbiddenException(
        'You do not have permission to edit this time entry.',
      );
    }
    // A paused entry isn't accruing, so giving it an end just closes it where
    // it already left off — allowed, and handled as a stop below. A *ticking*
    // one still refuses: ending a live timer here would leave no record of
    // how it ended, which is what `stop` is for.
    const openPause =
      entry.endedAt === null
        ? await this.timeEntryPauses.findOne({
            where: { timeEntryId: entry.id, resumedAt: IsNull() },
          })
        : null;
    if (entry.endedAt === null && dto.endedAt !== undefined && !openPause) {
      throw new ConflictException(
        'This timer is still running — pause or stop it before setting an end time.',
      );
    }

    const nextProjectId = dto.projectId ?? entry.projectId;
    const projectChanged = nextProjectId !== entry.projectId;
    // A Task belongs to exactly one Project, so a Task from the old
    // Project can't carry over silently when the Project itself changes.
    const nextTaskId =
      dto.taskId !== undefined
        ? dto.taskId
        : projectChanged
          ? null
          : entry.taskId;

    if (projectChanged || dto.taskId !== undefined) {
      await this.validateStart(
        organisationId,
        userId,
        nextProjectId,
        nextTaskId ?? undefined,
      );
    }

    const nextStartedAt = dto.startedAt
      ? new Date(dto.startedAt)
      : entry.startedAt;
    const nextEndedAt = dto.endedAt ? new Date(dto.endedAt) : entry.endedAt;
    if (nextEndedAt) {
      this.assertValidRange(nextStartedAt, nextEndedAt);
      await this.assertNoOverlap(
        entry.membershipId,
        entry.deviceId,
        entry.id,
        nextStartedAt,
        nextEndedAt,
        // A manual entry is held to the stricter rule however it is reached,
        // so one cannot be edited into an overlap it could not be created
        // with.
        entry.source === TimeEntrySource.MANUAL ? 'manual' : 'tracked',
      );
    } else if (nextStartedAt.getTime() > Date.now()) {
      // No end to bracket the start against — but a future start would still
      // render as a negative elapsed time.
      throw new ConflictException('Start time cannot be in the future.');
    }

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    if (projectChanged) {
      changed.projectId = { from: entry.projectId, to: nextProjectId };
    }
    if (nextTaskId !== entry.taskId) {
      changed.taskId = { from: entry.taskId, to: nextTaskId };
    }
    if (nextStartedAt.getTime() !== entry.startedAt.getTime()) {
      changed.startedAt = { from: entry.startedAt, to: nextStartedAt };
    }
    if (nextEndedAt?.getTime() !== entry.endedAt?.getTime()) {
      changed.endedAt = { from: entry.endedAt, to: nextEndedAt };
    }

    const previousSpan = {
      from: entry.startedAt,
      to: entry.endedAt ?? new Date(),
    };
    // Ending a paused entry closes its open pause at the same instant, the
    // same way `stop` does — otherwise the entry would end mid-pause and
    // report the break as worked time.
    if (openPause && nextEndedAt) {
      await this.closeOpenPause(this.timeEntryPauses, entry.id, nextEndedAt);
    }
    entry.projectId = nextProjectId;
    entry.taskId = nextTaskId;
    entry.startedAt = nextStartedAt;
    entry.endedAt = nextEndedAt;
    const saved = await this.timeEntries.save(entry);

    if (Object.keys(changed).length === 0) {
      return await this.toSummary(saved);
    }

    // Only a moved boundary can strand captures; a project or task change
    // leaves the covered span exactly as it was.
    const spanMoved = Boolean(changed.startedAt ?? changed.endedAt);

    const pruned = await this.dataSource.transaction(async (manager) => {
      const result = spanMoved
        ? await this.captureCleanup.pruneUncovered(
            manager,
            entry.membershipId,
            previousSpan,
          )
        : null;

      await this.auditLogService.record(manager, {
        action: 'time_entry.updated',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: saved.id,
          changed,
          ...(dto.reason ? { reason: dto.reason } : {}),
          ...(result ? { prunedCaptures: this.capturesSummary(result) } : {}),
        },
      });
      return result;
    });

    await this.captureCleanup.deleteStoredObjects(pruned?.storageKeys ?? []);

    return await this.toSummary(saved);
  }

  /**
   * Cuts one completed entry into two at `dto.at`, so a span covering two
   * different pieces of work can be attributed separately instead of being
   * deleted and retyped.
   *
   * The original survives as the *first* half, keeping its id — pause rows
   * point at it and earlier AuditLog entries name it — with only its
   * `endedAt` moved back. The second half is a new row inheriting Project,
   * Task, source and Device.
   *
   * Admin-only (`canEditEntry`). An unstopped entry can't be split: with no
   * end, the second half would have no span.
   */
  async split(
    organisationId: string,
    userId: string,
    timeEntryId: string,
    dto: SplitTimeEntryDto,
  ): Promise<{ first: TimeEntrySummary; second: TimeEntrySummary }> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const entry = await this.timeEntries.findOne({
      where: { id: timeEntryId, organisationId },
    });
    if (!entry) {
      throw new NotFoundException('Time entry not found.');
    }
    if (
      !(await this.canEditEntry(membership, organisationId, entry.membershipId))
    ) {
      throw new ForbiddenException(
        'You do not have permission to split this time entry.',
      );
    }
    if (entry.endedAt === null) {
      throw new ConflictException(
        'This timer has not stopped yet — stop it before splitting.',
      );
    }

    const at = new Date(dto.at);
    if (
      at.getTime() <= entry.startedAt.getTime() ||
      at.getTime() >= entry.endedAt.getTime()
    ) {
      throw new ConflictException(
        'The split point must fall between the start and end of the entry.',
      );
    }

    const originalEndedAt = entry.endedAt;

    const { first, second } = await this.dataSource.transaction(
      async (manager) => {
        const secondHalf = await manager.save(
          manager.create(TimeEntry, {
            organisationId,
            membershipId: entry.membershipId,
            projectId: entry.projectId,
            taskId: entry.taskId,
            startedAt: at,
            endedAt: originalEndedAt,
            source: entry.source,
            deviceId: entry.deviceId,
          }),
        );

        entry.endedAt = at;
        const firstHalf = await manager.save(entry);

        await this.movePausesAcrossSplit(
          manager,
          organisationId,
          entry.id,
          secondHalf.id,
          at,
        );

        await this.auditLogService.record(manager, {
          action: 'time_entry.split',
          organisationId,
          actorUserId: userId,
          metadata: {
            timeEntryId: entry.id,
            newTimeEntryId: secondHalf.id,
            at,
            originalEndedAt,
          },
        });

        return { first: firstHalf, second: secondHalf };
      },
    );

    return {
      first: await this.toSummary(first),
      second: await this.toSummary(second),
    };
  }

  /**
   * Re-homes pause spans either side of a split point: spans wholly after
   * the cut move to the new entry, and one straddling it becomes two — so
   * each half's paused time still matches the span it now covers.
   */
  private async movePausesAcrossSplit(
    manager: EntityManager,
    organisationId: string,
    firstHalfId: string,
    secondHalfId: string,
    at: Date,
  ): Promise<void> {
    const pauses = await manager.find(TimeEntryPause, {
      where: { timeEntryId: firstHalfId },
    });

    for (const pause of pauses) {
      const pausedAtMs = pause.pausedAt.getTime();
      // The entry is stopped, so every span here is closed; the fallback
      // only guards the type.
      const resumedAtMs = pause.resumedAt?.getTime() ?? pausedAtMs;

      if (pausedAtMs >= at.getTime()) {
        pause.timeEntryId = secondHalfId;
        await manager.save(pause);
        continue;
      }

      if (resumedAtMs > at.getTime()) {
        await manager.save(
          manager.create(TimeEntryPause, {
            organisationId,
            timeEntryId: secondHalfId,
            pausedAt: at,
            resumedAt: pause.resumedAt,
          }),
        );
        pause.resumedAt = at;
        await manager.save(pause);
      }
    }
  }

  /**
   * Deletes a Time entry outright — the row really goes, so no read path
   * needs a `deletedAt` filter it could forget. `time_entry_pauses` rows
   * follow via their own `onDelete: 'CASCADE'`, and the app events, URL
   * sessions and screenshots captured during its span go with it unless
   * another entry still covers them (see `CaptureCleanupService`): capture
   * only runs because a timer is running, so activity recorded for an entry
   * that turned out to be wrong is wrong too.
   *
   * Its own entries always, anyone's for an admin — see `canDeleteEntry`,
   * which is wider than the edit rule.
   *
   * The `time_entry.deleted` audit row therefore snapshots the whole entry
   * rather than referencing an id that no longer resolves, plus the
   * caller's `reason` when one was given.
   *
   * An unstopped entry can go too: deleting the row frees that person's
   * one-running-timer slot with it, and a desktop agent polling
   * `/device/time-entries/current` then finds none — the state it already
   * handles when a timer is stopped server-side.
   */
  async remove(
    organisationId: string,
    userId: string,
    timeEntryId: string,
    dto: DeleteTimeEntryDto = {},
  ): Promise<void> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const entry = await this.timeEntries.findOne({
      where: { id: timeEntryId, organisationId },
    });
    if (!entry) {
      throw new NotFoundException('Time entry not found.');
    }
    if (!this.canDeleteEntry(membership, entry.membershipId)) {
      throw new ForbiddenException(
        "You can only delete your own time entries — an admin can delete anyone's.",
      );
    }
    const span = { from: entry.startedAt, to: entry.endedAt ?? new Date() };

    // Snapshot, delete and prune in one transaction so a deleted entry can
    // never exist without its audit trail, nor the reverse. The prune runs
    // after the delete so coverage no longer counts this entry.
    const pruned = await this.dataSource.transaction(async (manager) => {
      await manager.delete(TimeEntry, { id: entry.id });
      const result = await this.captureCleanup.pruneUncovered(
        manager,
        entry.membershipId,
        span,
      );

      await this.auditLogService.record(manager, {
        action: 'time_entry.deleted',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: entry.id,
          membershipId: entry.membershipId,
          projectId: entry.projectId,
          taskId: entry.taskId,
          startedAt: entry.startedAt,
          endedAt: entry.endedAt,
          source: entry.source,
          deviceId: entry.deviceId,
          prunedCaptures: this.capturesSummary(result),
          // Only present when the caller gave one — see DeleteTimeEntryDto
          // for why it isn't mandatory.
          ...(dto.reason ? { reason: dto.reason } : {}),
        },
      });
      return result;
    });

    await this.captureCleanup.deleteStoredObjects(pruned.storageKeys);
  }

  /**
   * Rejects a span that would sit on top of another of this person's
   * entries. Touching endpoints are fine — one entry ending exactly where
   * the next begins is adjacency, not overlap, and is what `switch`
   * produces — so the comparison is strict at both ends.
   *
   * An entry that hasn't stopped counts as occupying everything from its
   * start, since there is no end yet to bound it.
   */
  private async assertNoOverlap(
    membershipId: string,
    deviceId: string | null,
    /** The entry being edited, excluded from the search. Null when creating
     * one, where there is nothing yet to exclude — an empty string here
     * reaches Postgres as a uuid and is rejected outright. */
    timeEntryId: string | null,
    startedAt: Date,
    endedAt: Date,
    scope: OverlapScope,
  ): Promise<void> {
    // Two scopes, because two different things are being prevented.
    //
    // A *tracked* entry is scoped to its Device, mirroring the running-timer
    // index: one machine cannot be in two places at once, but a laptop and a
    // desktop genuinely can, and that overlap is the normal state ADR-0022
    // supports. `IsNull()` rather than `deviceId` matches the index's NULLS
    // NOT DISTINCT — entries with no Device are all "the web", one timeline.
    //
    // A *manual* entry is scoped to the person, every Device included.
    // Nobody is in two places while typing a timesheet, so hours typed over
    // hours already tracked are a double-count rather than parallel work —
    // and the Device rule would miss it entirely, since a manual entry has
    // no Device and a tracked one does.
    const deviceScope =
      scope === 'manual'
        ? {}
        : { deviceId: deviceId === null ? IsNull() : Equal(deviceId) };
    const sameTimeline = {
      membershipId,
      ...deviceScope,
      ...(timeEntryId === null ? {} : { id: Not(timeEntryId) }),
    };
    const clash = await this.timeEntries.findOne({
      where: [
        {
          ...sameTimeline,
          startedAt: LessThan(endedAt),
          endedAt: MoreThan(startedAt),
        },
        {
          ...sameTimeline,
          startedAt: LessThan(endedAt),
          endedAt: IsNull(),
        },
      ],
    });
    if (clash) {
      throw new ConflictException(
        scope === 'manual'
          ? 'These times overlap time already tracked for this person. Adjust the times so they do not cover the same period.'
          : 'These times overlap another time entry from the same device — one machine cannot track two entries at once. Adjust the times so they do not cover the same period.',
      );
    }
  }

  /**
   * Average keyboard/mouse activity per entry, 0-100.
   *
   * Samples cover fixed 10-minute periods that rarely line up with an
   * entry's boundaries, so each is weighted by how much of it actually falls
   * inside the entry — a period half outside counts half. An entry no sample
   * covers is absent from the map rather than reported as 0%, which would
   * read as "they did nothing" instead of "nothing was measured".
   */
  private async getActivityFor(
    membershipId: string,
    entries: TimeEntry[],
  ): Promise<Map<string, number>> {
    const spans = entries.filter((entry) => entry.endedAt !== null);
    if (spans.length === 0) return new Map();

    const from = new Date(
      Math.min(...spans.map((entry) => entry.startedAt.getTime())),
    );
    const to = new Date(
      Math.max(...spans.map((entry) => entry.endedAt!.getTime())),
    );

    const samples = await this.activitySamples.find({
      where: {
        membershipId,
        periodStart: LessThan(to),
        periodEnd: MoreThan(from),
      },
    });
    if (samples.length === 0) return new Map();

    const byEntry = new Map<string, number>();
    for (const entry of spans) {
      let weighted = 0;
      let seconds = 0;
      for (const sample of samples) {
        const overlap =
          Math.min(entry.endedAt!.getTime(), sample.periodEnd.getTime()) -
          Math.max(entry.startedAt.getTime(), sample.periodStart.getTime());
        if (overlap <= 0) continue;
        weighted += sample.activePercentage * overlap;
        seconds += overlap;
      }
      if (seconds > 0) {
        byEntry.set(entry.id, Math.round(weighted / seconds));
      }
    }
    return byEntry;
  }

  /** The audit-facing shape of a prune: counts only, never storage keys. */
  private capturesSummary(pruned: PrunedCaptures): Record<string, number> {
    return {
      appEvents: pruned.appEvents,
      urlSessions: pruned.urlSessions,
      screenshots: pruned.screenshots,
    };
  }

  /**
   * Ends the caller's running timer, the same as `stop`.
   *
   * A Time entry is one unbroken worked span: play to stop. Pausing used to
   * punch a hole in an entry instead, which made its Duration disagree with
   * the Start-End it displayed — an entry paused overnight read as ten
   * hours of work for thirteen minutes of it — and left entries open across
   * midnight for the day-boundary splitter to tear into phantom rows.
   *
   * Kept as its own method rather than folded into `stop` so the agent and
   * the web keep their Pause control and their own audit action; what
   * changed is what it does. Pressing play afterwards starts a new entry.
   */
  async pause(
    organisationId: string,
    userId: string,
    deviceId: string | null,
  ): Promise<TimeEntrySummary> {
    return await this.stop(organisationId, userId, deviceId, undefined, {
      action: 'time_entry.paused',
    });
  }

  /**
   * Starts a fresh entry on whatever this Device was last tracking.
   *
   * There is nothing to resume any more — `pause` ends the entry — so this
   * does what pressing play does, picking the Project up from the last
   * entry stopped on this Device. Kept so an agent that has not updated
   * yet, which still calls pause then resume, keeps working rather than
   * stranding someone on a 404.
   */
  async resume(
    organisationId: string,
    userId: string,
    deviceId: string | null,
  ): Promise<TimeEntrySummary> {
    const membership = await this.getActiveMembership(organisationId, userId);

    const running = await this.timeEntries.findOne({
      where: this.runningForDevice(membership.id, deviceId),
    });
    if (running) {
      // Already tracking: nothing to start, and the caller's own view is
      // simply behind. Answering with the running entry re-syncs it.
      return await this.toSummary(running);
    }

    const last = await this.timeEntries.findOne({
      where: {
        membershipId: membership.id,
        deviceId: deviceId === null ? IsNull() : Equal(deviceId),
      },
      order: { endedAt: 'DESC' },
    });
    if (!last) {
      throw new NotFoundException('Nothing to resume on this device.');
    }

    return await this.start(
      organisationId,
      userId,
      last.projectId,
      last.taskId ?? undefined,
      last.source,
      deviceId,
    );
  }

  /**
   * Whether any Project has a timer running against it right now — checked
   * by ProjectsService before archiving, since an Archived project accepts
   * no changes at all and a live timer is very much an in-progress change.
   */
  async hasRunningEntryForProject(projectId: string): Promise<boolean> {
    const running = await this.timeEntries.findOne({
      where: { projectId, endedAt: IsNull() },
    });
    return running !== null;
  }

  /**
   * Whether a Project has any time logged against it at all — checked by
   * ProjectsService before deleting, since time entries feed payroll and
   * must never disappear along with their Project (archive it instead).
   */
  async hasEntriesForProject(projectId: string): Promise<boolean> {
    const entry = await this.timeEntries.findOne({ where: { projectId } });
    return entry !== null;
  }

  private async validateStart(
    organisationId: string,
    userId: string,
    projectId: string,
    taskId: string | undefined,
  ): Promise<ValidatedStart> {
    const membership = await this.getActiveMembership(organisationId, userId);
    await this.assertProjectAccess(membership, projectId);

    const project = await this.projects.findOne({
      where: { id: projectId, organisationId },
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    if (project.archivedAt) {
      throw new ConflictException(
        'This project is archived — unarchive it first to track time against it.',
      );
    }

    let task: Task | null = null;
    if (taskId) {
      task = await this.tasks.findOne({ where: { id: taskId, projectId } });
      if (!task) {
        throw new NotFoundException('Task not found.');
      }
      if (task.closedAt) {
        throw new ConflictException(
          'This task is closed — reopen it before tracking time against it.',
        );
      }
    }

    return { membership, task };
  }

  /**
   * Like `validateStart`, but for `createManual` specifically: resolves
   * which Membership the entry should be attributed to, after first
   * rejecting any caller who isn't an org admin. The entry lands on the
   * caller's own timesheet by default, or (when `targetMembershipId` names
   * someone else) that person's. The target still needs
   * their own access to the Project (checked via `assertProjectAccess`,
   * same as the caller) — delegation grants the *caller* extra reach, it
   * never lets them log time against a Project the target has no relation
   * to.
   */
  private async resolveManualEntryTarget(
    organisationId: string,
    userId: string,
    projectId: string,
    taskId: string | undefined,
    targetMembershipId: string | undefined,
  ): Promise<ValidatedStart> {
    const caller = await this.getActiveMembership(organisationId, userId);
    // Hand-authored hours are the ones no timer witnessed, so writing them
    // takes the same permission as rewriting them.
    if (!(await this.canModifyTime(caller, organisationId))) {
      throw new ForbiddenException(
        'You do not have permission to add a time entry manually.',
      );
    }
    await this.assertProjectAccess(caller, projectId);

    let membership = caller;
    if (targetMembershipId && targetMembershipId !== caller.id) {
      await this.assertCanLogTimeForOthers(caller, projectId);
      const target = await this.memberships.findOne({
        where: {
          id: targetMembershipId,
          organisationId,
          status: MembershipStatus.ACTIVE,
        },
      });
      if (!target) {
        throw new NotFoundException('Membership not found.');
      }
      // Same bound as editing: writing to someone's timesheet is never
      // wider than being able to read it.
      if (!(await this.canSeeMembership(caller, organisationId, target.id))) {
        throw new ForbiddenException(
          "You do not have access to this member's timesheet.",
        );
      }
      await this.assertProjectAccess(target, projectId);
      membership = target;
    }

    const project = await this.projects.findOne({
      where: { id: projectId, organisationId },
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    if (project.archivedAt) {
      throw new ConflictException(
        'This project is archived — unarchive it first to track time against it.',
      );
    }

    let task: Task | null = null;
    if (taskId) {
      task = await this.tasks.findOne({ where: { id: taskId, projectId } });
      if (!task) {
        throw new NotFoundException('Task not found.');
      }
      if (task.closedAt) {
        throw new ConflictException(
          'This task is closed — reopen it before tracking time against it.',
        );
      }
    }

    return { membership, task };
  }

  /**
   * Whether `caller` may attribute a manual entry to someone else on this
   * Project — an org admin/manager, or a direct `manager`-tier
   * ProjectMembership (see ProjectRoleGuard's own comment: a project role
   * only ever *adds* access, never restricts an org admin/manager).
   * Team-derived project access carries no role tier of its own, so it
   * doesn't unlock this — only a direct ProjectMembership does.
   */
  private async assertCanLogTimeForOthers(
    caller: Membership,
    projectId: string,
  ): Promise<void> {
    if (ORG_WIDE_ROLES.includes(caller.role)) {
      return;
    }

    const callerProjectMembership = await this.projectMemberships.findOne({
      where: { projectId, membershipId: caller.id },
    });
    if (callerProjectMembership?.role === ProjectMembershipRole.MANAGER) {
      return;
    }

    throw new ForbiddenException(
      'Only a project manager, or an org admin/manager, can log time for someone else.',
    );
  }

  /**
   * Whose timesheet this caller may read, and so — with `canModifyTime` —
   * whose they may write. Their own always, an admin everyone's, a manager
   * only members sharing a team they manage: the same rule the Members
   * list and Activity use, so a manager of no team sees only themselves.
   */
  private async canSeeMembership(
    caller: Membership,
    organisationId: string,
    targetMembershipId: string,
  ): Promise<boolean> {
    if (targetMembershipId === caller.id) return true;
    if (caller.role === MembershipRole.ADMIN) return true;
    if (caller.role !== MembershipRole.MANAGER) return false;

    const scopeTeamIds = getManagerScopeTeamIds(caller);
    if (scopeTeamIds.length === 0) return false;

    const target = await this.memberships.findOne({
      where: { id: targetMembershipId, organisationId },
      relations: { teamMemberships: true },
    });
    return (target?.teamMemberships ?? []).some((teamMembership) =>
      scopeTeamIds.includes(teamMembership.teamId),
    );
  }

  private async getActiveMembership(
    organisationId: string,
    userId: string,
  ): Promise<Membership> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
      // Loaded eagerly because `canSeeMembership` needs the caller's teams
      // on every timesheet read, and TypeORM won't populate them otherwise.
      relations: { teamMemberships: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }
    return membership;
  }

  /**
   * Org admin/manager can always track time on any Project, same as they
   * can always manage one — otherwise the caller needs their own
   * ProjectMembership (directly, or via a Team assigned to the project —
   * see ProjectTeam), which is what actually grants "permission to log
   * time against a specific Project" (see CONTEXT.md's Project membership
   * entry).
   */
  private async assertProjectAccess(
    membership: Membership,
    projectId: string,
  ): Promise<void> {
    if (ORG_WIDE_ROLES.includes(membership.role)) {
      return;
    }

    const projectMembership = await this.projectMemberships.findOne({
      where: { projectId, membershipId: membership.id },
    });
    if (projectMembership && isTimeTrackingRole(projectMembership.role)) {
      return;
    }

    if (
      await hasTeamProjectAccess(this.projectTeams, projectId, membership.id)
    ) {
      return;
    }

    throw new ForbiddenException(
      projectMembership
        ? 'Project viewers can see this project but can’t log time on it.'
        : 'You do not have the required role for this project.',
    );
  }

  /**
   * The one place client-supplied timestamps get checked — used by manual
   * create, edit, and a backdated stop alike, so the rule (end after
   * start, never in the future) can't drift between the three call sites.
   */
  /**
   * A reported start can't be in the future (a skewed clock) or overlap the
   * entry this Device last ended — in either case it is moved to the nearest
   * valid instant rather than rejected, since the device has no way to
   * redo it and the person did press start.
   */
  private async resolveStartedAt(
    membershipId: string,
    deviceId: string | null,
    requested?: Date,
  ): Promise<Date> {
    const now = new Date();
    if (!requested) return now;
    let startedAt = requested.getTime() > now.getTime() ? now : requested;
    const last = await this.timeEntries.findOne({
      where: {
        membershipId,
        deviceId: deviceId === null ? IsNull() : Equal(deviceId),
        endedAt: Not(IsNull()),
      },
      order: { endedAt: 'DESC' },
    });
    if (last?.endedAt && last.endedAt.getTime() > startedAt.getTime()) {
      startedAt = last.endedAt;
    }
    return startedAt;
  }

  private assertValidRange(startedAt: Date, endedAt: Date): void {
    if (endedAt.getTime() <= startedAt.getTime()) {
      throw new ConflictException('End time must be after the start time.');
    }
    if (endedAt.getTime() > Date.now()) {
      throw new ConflictException('End time cannot be in the future.');
    }
  }

  /**
   * Closes whatever open pause span exists for a Time entry, if any — used
   * by both `stop` and `switchTo` so ending an entry never leaves a
   * dangling open span behind. A no-op when the entry isn't paused. Takes
   * an explicit repository (rather than always `this.timeEntryPauses`) so
   * `switchTo` can pass a transaction-scoped one and keep the close in the
   * same transaction as the entry's own stop.
   */
  private async closeOpenPause(
    repo: Repository<TimeEntryPause>,
    timeEntryId: string,
    at: Date,
  ): Promise<void> {
    const openPause = await repo.findOne({
      where: { timeEntryId, resumedAt: IsNull() },
    });
    if (!openPause) {
      return;
    }
    // Never before the pause began. A backdated stop — an idle discard ends
    // the entry at the instant idle started — can carry an `at` earlier than
    // a pause opened afterwards, and a span that resumes before it starts
    // counts as negative paused time, inflating the duration.
    openPause.resumedAt =
      at.getTime() < openPause.pausedAt.getTime() ? openPause.pausedAt : at;
    await repo.save(openPause);
  }

  /**
   * Batches pause-span lookups for a set of Time entries into one query
   * (used by `list`) rather than one query per row — the single-entry call
   * sites (`toSummary`) go through this too, just with a one-element array,
   * so there's only one place that turns pause rows into a `PauseState`.
   */
  private async getPauseStatesFor(
    timeEntryIds: string[],
  ): Promise<Map<string, PauseState>> {
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
      // Clamped: a span that resumes before it was paused would otherwise
      // subtract from paused time and inflate the entry's duration. See
      // `time-entry-active-seconds.util.ts` for how such rows came about.
      const closedSeconds = spans
        .filter((span) => span.resumedAt !== null)
        .reduce(
          (total, span) =>
            total +
            Math.max(
              0,
              (span.resumedAt!.getTime() - span.pausedAt.getTime()) / 1000,
            ),
          0,
        );
      states.set(timeEntryId, {
        pausedAt: open?.pausedAt ?? null,
        pausedSeconds: Math.round(closedSeconds),
        spans: [...spans]
          .sort((a, b) => a.pausedAt.getTime() - b.pausedAt.getTime())
          .map((span) => ({
            pausedAt: span.pausedAt,
            resumedAt: span.resumedAt,
          })),
      });
    }
    return states;
  }

  private async toSummary(entry: TimeEntry): Promise<TimeEntrySummary> {
    const pauseState =
      (await this.getPauseStatesFor([entry.id])).get(entry.id) ??
      NO_PAUSE_STATE;
    return {
      id: entry.id,
      membershipId: entry.membershipId,
      projectId: entry.projectId,
      taskId: entry.taskId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      source: entry.source,
      deviceId: entry.deviceId,
      pausedAt: pauseState.pausedAt,
      pausedSeconds: pauseState.pausedSeconds,
    };
  }

  private toListItem(
    entry: TimeEntry,
    viewerMembership: Membership,
    pauseState: PauseState,
    canModifyTime: boolean,
    activePercentage?: number,
  ): TimeEntryListItem {
    return {
      id: entry.id,
      membershipId: entry.membershipId,
      projectId: entry.projectId,
      taskId: entry.taskId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      source: entry.source,
      deviceId: entry.deviceId,
      pausedAt: pauseState.pausedAt,
      pausedSeconds: pauseState.pausedSeconds,
      projectName: entry.project.name,
      projectColour: entry.project.colour,
      taskName: entry.task?.name ?? null,
      memberName: entry.membership?.user?.name ?? null,
      memberEmail: entry.membership?.user?.email ?? null,
      type: entry.type,
      activePercentage: activePercentage ?? null,
      durationSeconds: entry.endedAt
        ? Math.round(
            (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
          ) - pauseState.pausedSeconds
        : null,
      canEdit: canModifyTime,
      canDelete: this.canDeleteEntry(viewerMembership, entry.membershipId),
      pauses: pauseState.spans,
    };
  }

  /** Whether this person may add or rewrite hours at all. Gates every
   * role, an admin included; *whose* hours is `canSeeMembership`. */
  private async canModifyTime(
    membership: Membership,
    organisationId: string,
  ): Promise<boolean> {
    const effective =
      membership.timesheetModifyTime ??
      (await this.organisationModifyTime(organisationId));
    return effective === 'add_edit';
  }

  /** Modify time, bounded by whose timesheet you can see — the grant never
   * widens that. *Deleting* is wider still; see `canDeleteEntry`. */
  private async canEditEntry(
    viewerMembership: Membership,
    organisationId: string,
    entryMembershipId: string,
  ): Promise<boolean> {
    return (
      (await this.canModifyTime(viewerMembership, organisationId)) &&
      (await this.canSeeMembership(
        viewerMembership,
        organisationId,
        entryMembershipId,
      ))
    );
  }

  /** Checked on `start` only: a timer already running when the setting
   * changed is left alone, not killed under whoever is using it. */
  private async assertAppAllowed(
    membership: Membership,
    organisationId: string,
    source: TimeEntrySource,
  ): Promise<void> {
    // Typed, not tracked by a timer app.
    if (source === TimeEntrySource.MANUAL) return;

    const allowed =
      membership.allowedApps ??
      (await this.organisationAllowedApps(organisationId));
    if (isTimerSourceAllowed(source, allowed)) return;

    throw new ForbiddenException(
      allowed === 'desktop_only'
        ? 'Your organisation only allows time tracked from the desktop app.'
        : 'Your organisation only allows time tracked from the mobile app.',
    );
  }

  /**
   * Ends every running entry whose client Allowed apps no longer permits,
   * so a change takes effect at once rather than at the next `start`. The
   * hours already tracked are kept. Pass `membershipId` when one person's
   * override changed; omit it when the organisation default did.
   */
  async stopEntriesDisallowedByApps(
    organisationId: string,
    membershipId?: string,
  ): Promise<number> {
    const running = await this.timeEntries.find({
      where: {
        organisationId,
        endedAt: IsNull(),
        ...(membershipId ? { membershipId } : {}),
      },
      relations: { membership: true },
    });
    if (running.length === 0) return 0;

    const orgDefault = await this.organisationAllowedApps(organisationId);
    const disallowed = running.filter(
      (entry) =>
        !isTimerSourceAllowed(
          entry.source,
          entry.membership?.allowedApps ?? orgDefault,
        ),
    );
    if (disallowed.length === 0) return 0;

    const now = new Date();
    const ids = disallowed.map((entry) => entry.id);
    await this.dataSource.transaction(async (manager) => {
      // Pauses first, as suspending an Organisation does: an entry must
      // never end with one of its pauses still open.
      await manager.update(
        TimeEntryPause,
        { timeEntryId: In(ids), resumedAt: IsNull() },
        { resumedAt: now },
      );
      await manager.update(TimeEntry, { id: In(ids) }, { endedAt: now });
      await this.auditLogService.record(manager, {
        action: 'time_entry.stopped_by_allowed_apps',
        organisationId,
        metadata: { timeEntryIds: ids },
      });
    });
    return disallowed.length;
  }

  private async organisationAllowedApps(
    organisationId: string,
  ): Promise<AllowedApps> {
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    const settings = organisation?.settings as
      { allowedApps?: AllowedApps } | undefined;
    return settings?.allowedApps ?? DEFAULT_ALLOWED_APPS;
  }

  private async organisationModifyTime(
    organisationId: string,
  ): Promise<TimesheetModifyTime> {
    const organisation = await this.organisations.findOne({
      where: { id: organisationId },
    });
    const settings = organisation?.settings as
      { timesheetModifyTime?: TimesheetModifyTime } | undefined;
    return settings?.timesheetModifyTime ?? DEFAULT_TIMESHEET_MODIFY_TIME;
  }

  /**
   * Wider than editing: a mistimed timer is yours to withdraw, and the
   * `time_entry.deleted` audit row keeps the act on record. Admins may
   * delete anyone's.
   *
   * Non-admins are still held to their own entries — a member can only
   * *list* their own timesheet, but that's a read rule, and without this
   * the endpoint would accept any id from anyone.
   */
  private canDeleteEntry(
    viewerMembership: Membership,
    entryMembershipId: string,
  ): boolean {
    return (
      viewerMembership.role === MembershipRole.ADMIN ||
      entryMembershipId === viewerMembership.id
    );
  }
}
