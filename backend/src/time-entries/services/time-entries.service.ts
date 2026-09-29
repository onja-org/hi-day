import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Between,
  DataSource,
  EntityManager,
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
import { Membership } from '../../database/entities/membership.entity';
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
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
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

export interface CurrentTimeEntry {
  entry: TimeEntrySummary | null;
  /**
   * The server's own clock at the moment of the read — both the web
   * console and the desktop agent tick elapsed time from this instead of
   * their own local clocks, so a skewed device clock can't make the two
   * surfaces disagree about how long a timer has been running.
   */
  now: Date;
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
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
    @InjectRepository(TimeEntryPause)
    private readonly timeEntryPauses: Repository<TimeEntryPause>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
    @InjectRepository(ProjectTeam)
    private readonly projectTeams: Repository<ProjectTeam>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
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
  async start(
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

    const running = await this.timeEntries.findOne({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });
    if (running) {
      throw new ConflictException({
        message:
          'A timer is already running — stop it first, or use switch to move to this one.',
        runningEntry: await this.toSummary(running),
      });
    }

    const entry = this.timeEntries.create({
      organisationId,
      membershipId: membership.id,
      projectId,
      taskId: task?.id ?? null,
      startedAt: new Date(),
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
    endedAt?: Date,
  ): Promise<TimeEntrySummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.findOne({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });
    if (!running) {
      throw new NotFoundException('No timer is currently running.');
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
        action: 'time_entry.stopped',
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
      const running = await manager.findOne(TimeEntry, {
        where: { membershipId: membership.id, endedAt: IsNull() },
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
  ): Promise<CurrentTimeEntry> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.findOne({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });

    return {
      entry: running ? await this.toSummary(running) : null,
      now: new Date(),
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
    return entries.map((entry) =>
      this.toListItem(
        entry,
        membership,
        pauseStates.get(entry.id) ?? NO_PAUSE_STATE,
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
   * `ScreenshotsService.deleteExpired`. Splits at *this server's* local
   * midnight — `Organisation.settings.timezone` isn't read by anything else
   * in the app yet, so there's no per-org boundary to honour here either.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async splitRunningEntriesAcrossDayBoundary(): Promise<void> {
    const todayStart = this.startOfDay(new Date());

    const running = await this.timeEntries.find({
      where: { endedAt: IsNull(), startedAt: LessThan(todayStart) },
      take: DAY_BOUNDARY_SPLIT_BATCH_SIZE,
    });

    for (const entry of running) {
      await this.splitAcrossDayBoundaries(entry.id, todayStart);
    }
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
          this.startOfDay(entry.startedAt).getTime() >= todayStart.getTime()
        ) {
          return null; // already within today
        }

        const boundary = this.startOfNextDay(entry.startedAt);
        if (boundary.getTime() <= entry.startedAt.getTime()) {
          // Should be unreachable — startOfNextDay always lands on the
          // day *after* startedAt's day — but guard anyway rather than
          // risk a zero/negative-duration entry.
          return null;
        }

        entry.endedAt = boundary;
        await manager.save(entry);

        const pausesRepo = manager.getRepository(TimeEntryPause);
        const openPause = await pausesRepo.findOne({
          where: { timeEntryId: entry.id, resumedAt: IsNull() },
        });
        if (openPause) {
          openPause.resumedAt = boundary;
          await pausesRepo.save(openPause);
        }

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

        if (openPause) {
          // The person was paused going into midnight — stay paused
          // after it too, rather than silently resuming them.
          await pausesRepo.save(
            pausesRepo.create({
              organisationId: entry.organisationId,
              timeEntryId: next.id,
              pausedAt: boundary,
              resumedAt: null,
            }),
          );
        }

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

  private startOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private startOfNextDay(date: Date): Date {
    const next = this.startOfDay(date);
    next.setDate(next.getDate() + 1);
    return next;
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

    const entry = this.timeEntries.create({
      organisationId,
      membershipId: membership.id,
      projectId,
      taskId: task?.id ?? null,
      startedAt,
      endedAt,
      source: TimeEntrySource.MANUAL,
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
    if (!this.canEditEntry(membership)) {
      throw new ForbiddenException('Only an admin can edit a time entry.');
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
        entry.id,
        nextStartedAt,
        nextEndedAt,
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
    if (!this.canEditEntry(membership)) {
      throw new ForbiddenException('Only an admin can split a time entry.');
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
    timeEntryId: string,
    startedAt: Date,
    endedAt: Date,
  ): Promise<void> {
    const clash = await this.timeEntries.findOne({
      where: [
        {
          membershipId,
          id: Not(timeEntryId),
          startedAt: LessThan(endedAt),
          endedAt: MoreThan(startedAt),
        },
        {
          membershipId,
          id: Not(timeEntryId),
          startedAt: LessThan(endedAt),
          endedAt: IsNull(),
        },
      ],
    });
    if (clash) {
      throw new ConflictException(
        'These times overlap another time entry for this person — one moment cannot belong to two entries. Adjust the times so they do not cover the same period.',
      );
    }
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
   * Pauses the caller's running timer — the same entry keeps its `id` and
   * `endedAt` stays null (it is still "running" in every existing sense:
   * `current`, the single-running-timer index, `switchTo`'s lookups), it
   * just temporarily stops accumulating tracked time. Rejects with 409 if
   * there's no running entry, or if it's already paused.
   */
  async pause(
    organisationId: string,
    userId: string,
  ): Promise<TimeEntrySummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.findOne({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });
    if (!running) {
      throw new NotFoundException('No timer is currently running.');
    }

    const openPause = await this.timeEntryPauses.findOne({
      where: { timeEntryId: running.id, resumedAt: IsNull() },
    });
    if (openPause) {
      throw new ConflictException('This timer is already paused.');
    }

    const pause = this.timeEntryPauses.create({
      organisationId,
      timeEntryId: running.id,
      pausedAt: new Date(),
      resumedAt: null,
    });
    await this.timeEntryPauses.save(pause);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'time_entry.paused',
        organisationId,
        actorUserId: userId,
        metadata: { timeEntryId: running.id },
      });
    });

    return await this.toSummary(running);
  }

  /**
   * Resumes a paused timer by closing its open pause span — reuses
   * `assertValidRange` (a resume can never land before its own pause, or in
   * the future) for the same reason `stop`'s backdating does. Rejects with
   * 409 if there's no running entry, or if it isn't currently paused.
   */
  async resume(
    organisationId: string,
    userId: string,
  ): Promise<TimeEntrySummary> {
    const membership = await this.getActiveMembership(organisationId, userId);
    const running = await this.timeEntries.findOne({
      where: { membershipId: membership.id, endedAt: IsNull() },
    });
    if (!running) {
      throw new NotFoundException('No timer is currently running.');
    }

    const openPause = await this.timeEntryPauses.findOne({
      where: { timeEntryId: running.id, resumedAt: IsNull() },
    });
    if (!openPause) {
      throw new ConflictException('This timer is not paused.');
    }

    const resumedAt = new Date();
    this.assertValidRange(openPause.pausedAt, resumedAt);
    openPause.resumedAt = resumedAt;
    await this.timeEntryPauses.save(openPause);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'time_entry.resumed',
        organisationId,
        actorUserId: userId,
        metadata: {
          timeEntryId: running.id,
          pausedSeconds: Math.round(
            (resumedAt.getTime() - openPause.pausedAt.getTime()) / 1000,
          ),
        },
      });
    });

    return await this.toSummary(running);
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
    // Admin-only, the same gate as editing and deleting (`canEditEntry`):
    // hand-authored hours are the ones nobody's timer witnessed, so the
    // ability to write them sits with the same single role trusted to
    // rewrite them. Everyone else logs time by running a timer.
    if (!this.canEditEntry(caller)) {
      throw new ForbiddenException(
        'Only an admin can add a time entry manually.',
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
    openPause.resumedAt = at;
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
      durationSeconds: entry.endedAt
        ? Math.round(
            (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
          ) - pauseState.pausedSeconds
        : null,
      canEdit: this.canEditEntry(viewerMembership),
      canDelete: this.canDeleteEntry(viewerMembership, entry.membershipId),
      pauses: pauseState.spans,
    };
  }

  /**
   * Only an admin may edit or split an entry, anyone's including their own.
   * Rewriting recorded hours sits with one role; *deleting* is a separate,
   * wider rule — see `canDeleteEntry`.
   */
  private canEditEntry(viewerMembership: Membership): boolean {
    return viewerMembership.role === MembershipRole.ADMIN;
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
