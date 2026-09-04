import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { Task } from '../../database/entities/task.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import { CreateManualTimeEntryDto } from '../dto/create-manual-time-entry.dto';
import { UpdateTimeEntryDto } from '../dto/update-time-entry.dto';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

// A personal timesheet listing, not a report — plenty for one person's own
// history at a glance. Revisit with real pagination if/when this becomes a
// manager-facing, multi-person view.
const LIST_LIMIT = 200;

export interface TimeEntrySummary {
  id: string;
  membershipId: string;
  projectId: string;
  taskId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  source: TimeEntrySource;
  deviceId: string | null;
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

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
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
        runningEntry: this.toSummary(running),
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

    return this.toSummary(saved);
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

    return this.toSummary(saved);
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
        running.endedAt = new Date();
        await manager.save(running);
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

    return this.toSummary(saved);
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
      entry: running ? this.toSummary(running) : null,
      now: new Date(),
    };
  }

  /**
   * A timesheet: every Time entry logged by the caller (default) or, for
   * an admin/manager, by another `targetMembershipId` — most recent first,
   * with Project/Task names resolved so the page doesn't need a second
   * round-trip per row. A plain member/finance can only ever reach their
   * own (passing someone else's id 403s), matching who's allowed to edit
   * (see `canEditEntry`) — viewing and editing use the same role gate.
   */
  async list(
    organisationId: string,
    userId: string,
    targetMembershipId?: string,
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
      where: { membershipId: subjectMembershipId },
      relations: { project: true, task: true },
      order: { startedAt: 'DESC' },
      take: LIST_LIMIT,
    });

    return entries.map((entry) => this.toListItem(entry, membership));
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

    return this.toSummary(saved);
  }

  /**
   * Edits a completed Time entry. Only an admin (anyone's, including their
   * own) or a manager (anyone's *except their own*) can edit — a plain
   * member/finance can't edit any entry, not even one they logged
   * themselves; see `canEditEntry`. A manager being unable to correct
   * their own hours is deliberate: the same role that can edit other
   * people's time shouldn't also be able to quietly pad or trim its own,
   * without needing anyone else to sign off. Rejects editing a
   * still-running entry (409, points at stop/switch instead): letting
   * `endedAt` be set through here would silently stop a timer without
   * going through `time_entry.stopped`, and changing `projectId` on a
   * live entry has no clean "when did the attribution change" boundary.
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

    return this.toSummary(saved);
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

  private toSummary(entry: TimeEntry): TimeEntrySummary {
    return {
      id: entry.id,
      membershipId: entry.membershipId,
      projectId: entry.projectId,
      taskId: entry.taskId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      source: entry.source,
      deviceId: entry.deviceId,
    };
  }

  private toListItem(
    entry: TimeEntry,
    viewerMembership: Membership,
  ): TimeEntryListItem {
    return {
      ...this.toSummary(entry),
      projectName: entry.project.name,
      projectColour: entry.project.colour,
      taskName: entry.task?.name ?? null,
      durationSeconds: entry.endedAt
        ? Math.round(
            (entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000,
          )
        : null,
      canEdit: this.canEditEntry(viewerMembership, entry.membershipId),
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
