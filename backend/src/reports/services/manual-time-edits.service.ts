import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { canViewMembership } from '../../common/membership-visibility.util';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { Task } from '../../database/entities/task.entity';
import { TimeEntry } from '../../database/entities/time-entry.entity';

export type ManualTimeEditAction = 'add' | 'edit' | 'delete';

export interface ManualTimeEditRow {
  id: string;
  action: ManualTimeEditAction;
  membershipId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  taskName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** Signed: what the edit added to (or took from) the person's tracked time. */
  changeSeconds: number;
  reason: string | null;
  changedByName: string | null;
  changedAt: string;
}

export type ManualTimeEditsScope = 'me' | 'all';

const ACTION_BY_AUDIT_ACTION: Record<string, ManualTimeEditAction> = {
  'time_entry.created_manually': 'add',
  'time_entry.updated': 'edit',
  'time_entry.deleted': 'delete',
};

// A month of edits is a few hundred rows at most; this only stops a runaway
// range from loading the whole audit table.
const ROW_LIMIT = 2000;

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

interface Span {
  startedAt: Date | null;
  endedAt: Date | null;
}

interface EntryFacts extends Span {
  membershipId: string | null;
  projectId: string | null;
  taskId: string | null;
}

type FieldChange = { from?: unknown; to?: unknown };

function asDate(value: unknown): Date | null {
  return typeof value === 'string' || value instanceof Date
    ? new Date(value)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function seconds(span: Span): number {
  return span.startedAt && span.endedAt
    ? Math.max(
        0,
        Math.round((span.endedAt.getTime() - span.startedAt.getTime()) / 1000),
      )
    : 0;
}

@Injectable()
export class ManualTimeEditsService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(TimeEntry)
    private readonly timeEntries: Repository<TimeEntry>,
  ) {}

  /**
   * Every manual add, edit and delete of a Time entry in `[from, to]`, read
   * back from the AuditLog. "me" is the edits that landed on the caller's own
   * timesheet; "all" is open to an admin or manager only — every member's
   * for an admin, and for a manager those of people they can view (see
   * canViewMembership), as on every other report.
   *
   * An edit's audit row names only the entry and what changed, so who it
   * belongs to comes from the entry itself — or, if it has since been
   * deleted, from that deletion's snapshot.
   */
  async list(
    organisationId: string,
    userId: string,
    scope: ManualTimeEditsScope,
    from: Date,
    to: Date,
  ): Promise<ManualTimeEditRow[]> {
    const caller = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
      relations: { teamMemberships: true },
    });
    if (!caller) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }
    if (scope === 'all' && !ORG_WIDE_ROLES.includes(caller.role)) {
      throw new ForbiddenException(
        "Only an admin or manager can view other members' manual time edits.",
      );
    }

    const logs = await this.auditLogs.find({
      where: {
        organisationId,
        action: In(Object.keys(ACTION_BY_AUDIT_ACTION)),
        createdAt: Between(from, to),
      },
      relations: { actorUser: true },
      order: { createdAt: 'DESC' },
      take: ROW_LIMIT,
    });

    const facts = await this.entryFactsFor(organisationId, logs);
    const rows = logs.map((log) => this.toFacts(log, facts));

    const members = await this.memberships.find({
      where: {
        organisationId,
        id: In(
          rows
            .map(({ entry }) => entry.membershipId)
            .filter((id): id is string => !!id),
        ),
      },
      relations: { user: true, teamMemberships: true },
    });
    const memberById = new Map(members.map((member) => [member.id, member]));

    const visible = rows.filter(({ entry }) => {
      if (scope === 'me') return entry.membershipId === caller.id;
      if (caller.role === MembershipRole.ADMIN) return true;
      const member = entry.membershipId
        ? memberById.get(entry.membershipId)
        : undefined;
      return !!member && canViewMembership(caller, member);
    });

    const [projects, tasks] = await Promise.all([
      this.projects.find({
        where: {
          organisationId,
          id: In(
            visible
              .map(({ entry }) => entry.projectId)
              .filter((id): id is string => !!id),
          ),
        },
      }),
      this.tasks.find({
        where: {
          id: In(
            visible
              .map(({ entry }) => entry.taskId)
              .filter((id): id is string => !!id),
          ),
        },
      }),
    ]);
    const projectById = new Map(
      projects.map((project) => [project.id, project]),
    );
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    return visible.map(({ log, action, entry, changeSeconds }) => {
      const member = entry.membershipId
        ? memberById.get(entry.membershipId)
        : undefined;
      return {
        id: log.id,
        action,
        membershipId: entry.membershipId,
        memberName: member?.user?.name ?? null,
        memberEmail: member?.user?.email ?? null,
        projectId: entry.projectId,
        projectName: entry.projectId
          ? (projectById.get(entry.projectId)?.name ?? null)
          : null,
        taskName: entry.taskId
          ? (taskById.get(entry.taskId)?.name ?? null)
          : null,
        startedAt: entry.startedAt?.toISOString() ?? null,
        endedAt: entry.endedAt?.toISOString() ?? null,
        changeSeconds,
        reason: asString(log.metadata.reason),
        changedByName: log.actorUser?.name ?? log.actorUser?.email ?? null,
        changedAt: log.createdAt.toISOString(),
      };
    });
  }

  /** What each referenced entry looks like now, or at its deletion if it is gone. */
  private async entryFactsFor(
    organisationId: string,
    logs: AuditLog[],
  ): Promise<Map<string, EntryFacts>> {
    const facts = new Map<string, EntryFacts>();
    const editedIds = logs
      .filter((log) => log.action === 'time_entry.updated')
      .map((log) => asString(log.metadata.timeEntryId))
      .filter((id): id is string => !!id);
    if (editedIds.length === 0) return facts;

    const live = await this.timeEntries.find({
      where: { organisationId, id: In(editedIds) },
    });
    for (const entry of live) {
      facts.set(entry.id, {
        membershipId: entry.membershipId,
        projectId: entry.projectId,
        taskId: entry.taskId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
      });
    }

    const gone = editedIds.filter((id) => !facts.has(id));
    if (gone.length > 0) {
      const deletions = await this.auditLogs
        .createQueryBuilder('log')
        .where('log.organisationId = :organisationId', { organisationId })
        .andWhere('log.action = :action', { action: 'time_entry.deleted' })
        .andWhere("log.metadata->>'timeEntryId' IN (:...gone)", { gone })
        .getMany();
      for (const deletion of deletions) {
        const id = asString(deletion.metadata.timeEntryId);
        if (id) facts.set(id, this.snapshotFacts(deletion.metadata));
      }
    }
    return facts;
  }

  private snapshotFacts(metadata: Record<string, unknown>): EntryFacts {
    return {
      membershipId: asString(metadata.membershipId),
      projectId: asString(metadata.projectId),
      taskId: asString(metadata.taskId),
      startedAt: asDate(metadata.startedAt),
      endedAt: asDate(metadata.endedAt),
    };
  }

  private toFacts(
    log: AuditLog,
    facts: Map<string, EntryFacts>,
  ): {
    log: AuditLog;
    action: ManualTimeEditAction;
    entry: EntryFacts;
    changeSeconds: number;
  } {
    const action = ACTION_BY_AUDIT_ACTION[log.action];
    if (action !== 'edit') {
      const entry = this.snapshotFacts(log.metadata);
      const duration = seconds(entry);
      return {
        log,
        action,
        entry,
        changeSeconds: action === 'add' ? duration : -duration,
      };
    }

    const changed = (log.metadata.changed ?? {}) as Record<string, FieldChange>;
    const current = facts.get(asString(log.metadata.timeEntryId) ?? '') ?? {
      membershipId: null,
      projectId: null,
      taskId: null,
      startedAt: null,
      endedAt: null,
    };
    // The entry may have been edited again since, so the span this edit
    // produced is its own `to`, not whatever the entry is now.
    const after: Span = {
      startedAt: asDate(changed.startedAt?.to) ?? current.startedAt,
      endedAt:
        'endedAt' in changed ? asDate(changed.endedAt?.to) : current.endedAt,
    };
    const before: Span = {
      startedAt: asDate(changed.startedAt?.from) ?? after.startedAt,
      endedAt:
        'endedAt' in changed ? asDate(changed.endedAt?.from) : after.endedAt,
    };
    return {
      log,
      action,
      entry: {
        membershipId: current.membershipId,
        projectId: asString(changed.projectId?.to) ?? current.projectId,
        taskId:
          'taskId' in changed ? asString(changed.taskId?.to) : current.taskId,
        ...after,
      },
      changeSeconds: seconds(after) - seconds(before),
    };
  }
}
