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
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { Task } from '../../database/entities/task.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntryPause } from '../../database/entities/time-entry-pause.entity';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import { CreateManualTimeEntryDto } from '../dto/create-manual-time-entry.dto';
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
  /** null while the entry is still running (endedAt is null). */
  durationSeconds: number | null;
  /**
   * Whether the *viewer* (not the entry's owner) can edit this entry —
   * admin can edit anyone's, manager can edit anyone's but their own, a
   * plain member/finance can edit no one's, not even their own. Lets the
   * frontend hide the Edit action per-row without re-deriving the rule
   * itself.
   */
  canEdit: boolean;
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
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
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
      relations: { project: true, task: true },
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
   * Directly logs a completed span of time with an explicit start/end,
   * rather than starting a live timer — same access rule as `start`
   * (org admin/manager, or a ProjectMembership on this Project).
   */
  async createManual(
    organisationId: string,
    userId: string,
    projectId: string,
    dto: CreateManualTimeEntryDto,
  ): Promise<TimeEntrySummary> {
    const { membership, task } = await this.validateStart(
      organisationId,
      userId,
      projectId,
      dto.taskId,
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
   * Edits a completed Time entry. Admins may edit anyone's including their
   * own; managers anyone's except their own, so the role that can edit
   * others cannot quietly adjust its own hours. See `canEditEntry`.
   *
   * Rejects a still-running entry (409): setting `endedAt` here would stop
   * a timer without emitting `time_entry.stopped`, and re-attributing a
   * live entry has no clean boundary.
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
    if (!this.canEditEntry(membership, entry.membershipId)) {
      throw new ForbiddenException(
        'Only an admin or manager can edit a time entry — and a manager cannot edit their own.',
      );
    }
    if (entry.endedAt === null) {
      throw new ConflictException(
        'This timer is still running — stop or switch it before editing.',
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
    this.assertValidRange(nextStartedAt, nextEndedAt);

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
    if (nextEndedAt.getTime() !== entry.endedAt.getTime()) {
      changed.endedAt = { from: entry.endedAt, to: nextEndedAt };
    }

    entry.projectId = nextProjectId;
    entry.taskId = nextTaskId;
    entry.startedAt = nextStartedAt;
    entry.endedAt = nextEndedAt;

    const saved = await this.timeEntries.save(entry);

    if (Object.keys(changed).length > 0) {
      await this.dataSource.transaction(async (manager) => {
        await this.auditLogService.record(manager, {
          action: 'time_entry.updated',
          organisationId,
          actorUserId: userId,
          metadata: { timeEntryId: saved.id, changed },
        });
      });
    }

    return await this.toSummary(saved);
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
   * ProjectMembership, which is what actually grants "permission to log
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
    if (!projectMembership) {
      throw new ForbiddenException(
        'You do not have the required role for this project.',
      );
    }
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
      durationSeconds: entry.endedAt
        ? Math.round(
            (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
          ) - pauseState.pausedSeconds
        : null,
      canEdit: this.canEditEntry(viewerMembership, entry.membershipId),
      pauses: pauseState.spans,
    };
  }

  /**
   * Admin can edit any entry, including their own. Manager can edit any
   * entry *except* their own. Everyone else (plain member, finance) can't
   * edit any entry, including their own — see `update`'s doc comment for
   * why a manager doesn't get to self-edit.
   */
  private canEditEntry(
    viewerMembership: Membership,
    entryMembershipId: string,
  ): boolean {
    if (viewerMembership.role === MembershipRole.ADMIN) {
      return true;
    }
    if (viewerMembership.role === MembershipRole.MANAGER) {
      return entryMembershipId !== viewerMembership.id;
    }
    return false;
  }
}
