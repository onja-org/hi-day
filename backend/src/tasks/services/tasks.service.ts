import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';
import { Task } from '../../database/entities/task.entity';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';

const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

export interface TaskAssigneeSummary {
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  estimate: string | null;
  dueDate: string | null;
  status: 'open' | 'closed';
  closedAt: Date | null;
  assignee: TaskAssigneeSummary | null;
  /** Whether the task's assignee is the caller — lets the UI show a "yours"
   * close/reopen action without the frontend needing to know its own user id. */
  assignedToMe: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskProjectContext {
  id: string;
  name: string;
  colour: ProjectColour;
  status: 'active' | 'archived';
}

export interface ProjectTasksList {
  project: TaskProjectContext;
  tasks: TaskSummary[];
  /** Whether the caller can create/edit/reassign tasks on this project —
   * org admin/manager or a project-admin. Lets the UI hide actions a plain
   * assigned member can't use, instead of showing a button that always 403s. */
  canManage: boolean;
}

interface ActorRole {
  isOrgAdminOrManager: boolean;
  projectMembership: ProjectMembership | null;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async list(
    organisationId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<ProjectTasksList> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    const role = await this.resolveActorRole(
      organisationId,
      projectId,
      actorUserId,
    );

    const tasks = await this.tasks.find({
      where: { projectId },
      relations: { assignee: { membership: { user: true } } },
      order: { createdAt: 'ASC' },
    });

    return {
      project: this.toProjectContext(project),
      tasks: tasks.map((task) => this.toSummary(task, { viewerRole: role })),
      canManage: this.canManage(role),
    };
  }

  async findOne(
    organisationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
  ): Promise<TaskSummary> {
    await this.getProjectOrThrow(organisationId, projectId);
    const task = await this.getTaskOrThrow(projectId, taskId);
    const role = await this.resolveActorRole(
      organisationId,
      projectId,
      actorUserId,
    );
    return this.toSummary(task, { viewerRole: role });
  }

  async create(
    organisationId: string,
    projectId: string,
    actorUserId: string,
    dto: CreateTaskDto,
  ): Promise<TaskSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const assignee = await this.resolveAssignee(
      projectId,
      dto.assigneeProjectMembershipId,
    );

    const task = this.tasks.create({
      projectId,
      name: dto.name,
      description: normalizeText(dto.description),
      estimate: dto.estimate ?? null,
      dueDate: dto.dueDate ?? null,
      assigneeProjectMembershipId: assignee?.id ?? null,
    });

    const saved = await this.tasks.save(task);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'task.created',
        organisationId,
        actorUserId,
        metadata: { taskId: saved.id, projectId, name: saved.name },
      });
    });

    const role = await this.resolveActorRole(
      organisationId,
      projectId,
      actorUserId,
    );
    return this.toSummary(saved, {
      assigneeOverride: assignee,
      viewerRole: role,
    });
  }

  async update(
    organisationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const task = await this.getTaskOrThrow(projectId, taskId);

    if (dto.name !== undefined) task.name = dto.name;
    if (dto.description !== undefined)
      task.description = normalizeText(dto.description);
    if (dto.estimate !== undefined) task.estimate = dto.estimate;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;

    let assigneeOverride: ProjectMembership | null | undefined;
    if (dto.assigneeProjectMembershipId !== undefined) {
      assigneeOverride = await this.resolveAssignee(
        projectId,
        dto.assigneeProjectMembershipId,
      );
      task.assigneeProjectMembershipId = assigneeOverride?.id ?? null;
    }

    const saved = await this.tasks.save(task);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'task.updated',
        organisationId,
        actorUserId,
        metadata: { taskId: saved.id, projectId },
      });
    });

    const role = await this.resolveActorRole(
      organisationId,
      projectId,
      actorUserId,
    );
    return this.toSummary(saved, { assigneeOverride, viewerRole: role });
  }

  async close(
    organisationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
  ): Promise<TaskSummary> {
    return this.setClosed(organisationId, projectId, taskId, actorUserId, true);
  }

  async reopen(
    organisationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
  ): Promise<TaskSummary> {
    return this.setClosed(
      organisationId,
      projectId,
      taskId,
      actorUserId,
      false,
    );
  }

  private async setClosed(
    organisationId: string,
    projectId: string,
    taskId: string,
    actorUserId: string,
    closed: boolean,
  ): Promise<TaskSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const task = await this.getTaskOrThrow(projectId, taskId);
    const role = await this.resolveActorRole(
      organisationId,
      projectId,
      actorUserId,
    );

    if (!this.canCloseOrReopen(role, task)) {
      throw new ForbiddenException(
        'Only the assignee or a project admin can close or reopen this task.',
      );
    }

    const alreadyInState = closed
      ? task.closedAt !== null
      : task.closedAt === null;
    if (alreadyInState) {
      return this.toSummary(task, { viewerRole: role });
    }

    task.closedAt = closed ? new Date() : null;
    const saved = await this.tasks.save(task);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: closed ? 'task.closed' : 'task.reopened',
        organisationId,
        actorUserId,
        metadata: { taskId, projectId },
      });
    });

    return this.toSummary(saved, { viewerRole: role });
  }

  /**
   * Resolves the caller's authority on this project: an org admin/manager
   * always has it; otherwise it comes from their ProjectMembership (if any).
   * Shared by list/findOne (to compute canManage/assignedToMe) and
   * close/reopen (to enforce "assignee or project admin").
   */
  private async resolveActorRole(
    organisationId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<ActorRole> {
    const membership = await this.memberships.findOne({
      where: {
        userId: actorUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this project.',
      );
    }

    const isOrgAdminOrManager = ORG_WIDE_ROLES.includes(membership.role);
    const projectMembership = isOrgAdminOrManager
      ? null
      : await this.projectMemberships.findOne({
          where: { projectId, membershipId: membership.id },
        });

    return { isOrgAdminOrManager, projectMembership };
  }

  private canManage(role: ActorRole): boolean {
    return (
      role.isOrgAdminOrManager ||
      role.projectMembership?.role === ProjectMembershipRole.MANAGER
    );
  }

  private canCloseOrReopen(role: ActorRole, task: Task): boolean {
    return (
      this.canManage(role) ||
      (role.projectMembership != null &&
        task.assigneeProjectMembershipId === role.projectMembership.id)
    );
  }

  /**
   * Resolves an assignee input to its ProjectMembership row (loaded with the
   * user relation for the summary), enforcing that the assignee is actually
   * on this project — an org member who isn't assigned to the project can't
   * be assigned a task on it.
   */
  private async resolveAssignee(
    projectId: string,
    assigneeProjectMembershipId: string | null | undefined,
  ): Promise<ProjectMembership | null> {
    if (!assigneeProjectMembershipId) {
      return null;
    }

    const projectMembership = await this.projectMemberships.findOne({
      where: { id: assigneeProjectMembershipId, projectId },
      relations: { membership: { user: true } },
    });
    if (!projectMembership) {
      throw new NotFoundException('Assignee is not a member of this project.');
    }

    return projectMembership;
  }

  private async getProjectOrThrow(
    organisationId: string,
    projectId: string,
  ): Promise<Project> {
    const project = await this.projects.findOne({
      where: { id: projectId, organisationId },
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }

  private async getTaskOrThrow(
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    const task = await this.tasks.findOne({
      where: { id: taskId, projectId },
      relations: { assignee: { membership: { user: true } } },
    });
    if (!task) {
      throw new NotFoundException('Task not found.');
    }
    return task;
  }

  private assertNotArchived(project: Project): void {
    if (project.archivedAt) {
      throw new ConflictException(
        'This project is archived — unarchive it first to make changes.',
      );
    }
  }

  private toProjectContext(project: Project): TaskProjectContext {
    return {
      id: project.id,
      name: project.name,
      colour: project.colour,
      status: project.archivedAt ? 'archived' : 'active',
    };
  }

  private toSummary(
    task: Task,
    opts: {
      assigneeOverride?: ProjectMembership | null;
      viewerRole: ActorRole;
    },
  ): TaskSummary {
    const assignee =
      opts.assigneeOverride !== undefined
        ? opts.assigneeOverride
        : task.assignee;
    const viewerProjectMembershipId =
      opts.viewerRole.projectMembership?.id ?? null;

    return {
      id: task.id,
      projectId: task.projectId,
      name: task.name,
      description: task.description,
      estimate: task.estimate,
      dueDate: task.dueDate,
      status: task.closedAt ? 'closed' : 'open',
      closedAt: task.closedAt,
      assignedToMe:
        viewerProjectMembershipId != null &&
        task.assigneeProjectMembershipId === viewerProjectMembershipId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      assignee: assignee
        ? {
            membershipId: assignee.id,
            userId: assignee.membership.userId,
            email: assignee.membership.user.email,
            name: assignee.membership.user.name,
          }
        : null,
    };
  }
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
