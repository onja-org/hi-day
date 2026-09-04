import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';
import { Task } from '../../database/entities/task.entity';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { AddProjectMemberDto } from '../dto/add-project-member.dto';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateProjectMemberDto } from '../dto/update-project-member.dto';
import { resolveProjectRate } from '../resolve-project-rate.util';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

export interface ProjectSummary {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  colour: ProjectColour;
  billable: boolean;
  rate: string | null;
  status: 'active' | 'archived';
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberSummary {
  id: string;
  membershipId: string;
  userId: string;
  email: string;
  name: string | null;
  role: ProjectMembershipRole;
  rate: string | null;
  effectiveRate: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  members: ProjectMemberSummary[];
}

export interface ProjectListItem extends ProjectSummary {
  taskCount: number;
}

export interface ListProjectsFilter {
  status?: 'active' | 'archived';
  client?: string;
}

export interface AssignableMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string | null;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(ProjectMembership)
    private readonly projectMemberships: Repository<ProjectMembership>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * The projects a caller can track time against: every active Project for
   * an org admin/manager, or just the ones they hold a ProjectMembership on
   * otherwise — mirrors the access rule TimeEntriesService.start enforces,
   * so this list never shows a project that starting a timer would then
   * reject.
   */
  async listForTimeTracking(
    organisationId: string,
    userId: string,
  ): Promise<ProjectListItem[]> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    let projects: Project[];
    if (ORG_WIDE_ROLES.includes(membership.role)) {
      projects = await this.projects.find({
        where: { organisationId, archivedAt: IsNull() },
        order: { name: 'ASC' },
      });
    } else {
      const projectMemberships = await this.projectMemberships.find({
        where: { membershipId: membership.id },
        relations: { project: true },
      });
      projects = projectMemberships
        .map((pm) => pm.project)
        .filter((project) => !project.archivedAt)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const taskCounts = await this.getTaskCounts(projects.map((p) => p.id));
    return projects.map((project) => ({
      ...this.toSummary(project),
      taskCount: taskCounts.get(project.id) ?? 0,
    }));
  }

  async list(
    organisationId: string,
    filter: ListProjectsFilter,
  ): Promise<ProjectListItem[]> {
    const query = this.projects
      .createQueryBuilder('project')
      .where('project.organisationId = :organisationId', { organisationId });

    if (filter.status === 'active') {
      query.andWhere('project.archivedAt IS NULL');
    } else if (filter.status === 'archived') {
      query.andWhere('project.archivedAt IS NOT NULL');
    }

    if (filter.client) {
      query.andWhere('project.client = :client', { client: filter.client });
    }

    query.orderBy('project.name', 'ASC');

    const projects = await query.getMany();
    const taskCounts = await this.getTaskCounts(projects.map((p) => p.id));

    return projects.map((project) => ({
      ...this.toSummary(project),
      taskCount: taskCounts.get(project.id) ?? 0,
    }));
  }

  /**
   * A single grouped count query instead of one COUNT per project, so the
   * list page stays O(1) queries regardless of how many projects it shows.
   */
  private async getTaskCounts(
    projectIds: string[],
  ): Promise<Map<string, number>> {
    if (projectIds.length === 0) {
      return new Map();
    }

    const rows = await this.tasks
      .createQueryBuilder('task')
      .select('task.projectId', 'projectId')
      .addSelect('COUNT(*)', 'count')
      .where('task.projectId IN (:...projectIds)', { projectIds })
      .groupBy('task.projectId')
      .getRawMany<{ projectId: string; count: string }>();

    return new Map(rows.map((row) => [row.projectId, Number(row.count)]));
  }

  /**
   * Deliberately narrower than MembershipsService.listActiveForOrganisation
   * — a project-admin who is only an org "member" shouldn't see the whole
   * org's roster (roles, teams, status) just to pick who to assign to
   * their project, only enough to identify each person.
   */
  async listAssignableMembers(
    organisationId: string,
  ): Promise<AssignableMemberSummary[]> {
    const memberships = await this.memberships.find({
      where: { organisationId, status: MembershipStatus.ACTIVE },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
    }));
  }

  async findOne(
    organisationId: string,
    projectId: string,
  ): Promise<ProjectDetail> {
    const project = await this.getProjectOrThrow(organisationId, projectId);

    const members = await this.projectMemberships.find({
      where: { projectId },
      relations: { membership: { user: true } },
      order: { createdAt: 'ASC' },
    });

    return {
      ...this.toSummary(project),
      members: members.map((projectMembership) =>
        this.toMemberSummary(project, projectMembership),
      ),
    };
  }

  async create(
    organisationId: string,
    actorUserId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectSummary> {
    const existing = await this.projects.findOne({
      where: { organisationId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'A project with this name already exists in this organisation.',
      );
    }

    const project = this.projects.create({
      organisationId,
      name: dto.name,
      client: normalizeText(dto.client),
      description: normalizeText(dto.description),
      colour: dto.colour ?? ProjectColour.BLUE,
      billable: dto.billable ?? false,
      rate: dto.rate ?? null,
    });

    const saved = await this.projects.save(project).catch((error: unknown) => {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A project with this name already exists in this organisation.',
        );
      }
      throw error;
    });

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.created',
        organisationId,
        actorUserId,
        metadata: { projectId: saved.id, name: saved.name },
      });
    });

    return this.toSummary(saved);
  }

  async update(
    organisationId: string,
    projectId: string,
    actorUserId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.client !== undefined) project.client = normalizeText(dto.client);
    if (dto.description !== undefined)
      project.description = normalizeText(dto.description);
    if (dto.colour !== undefined) project.colour = dto.colour;
    if (dto.billable !== undefined) project.billable = dto.billable;
    if (dto.rate !== undefined) project.rate = dto.rate;

    const saved = await this.projects.save(project).catch((error: unknown) => {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A project with this name already exists in this organisation.',
        );
      }
      throw error;
    });

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.updated',
        organisationId,
        actorUserId,
        metadata: { projectId: saved.id },
      });
    });

    return this.toSummary(saved);
  }

  async archive(
    organisationId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<ProjectSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);

    if (project.archivedAt) {
      return this.toSummary(project);
    }

    if (await this.timeEntriesService.hasRunningEntryForProject(projectId)) {
      throw new ConflictException(
        'A timer is currently running against this project — stop it before archiving.',
      );
    }

    project.archivedAt = new Date();
    await this.projects.save(project);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.archived',
        organisationId,
        actorUserId,
        metadata: { projectId: project.id },
      });
    });

    return this.toSummary(project);
  }

  async unarchive(
    organisationId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<ProjectSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);

    if (!project.archivedAt) {
      return this.toSummary(project);
    }

    project.archivedAt = null;
    await this.projects.save(project);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.unarchived',
        organisationId,
        actorUserId,
        metadata: { projectId: project.id },
      });
    });

    return this.toSummary(project);
  }

  async addMember(
    organisationId: string,
    projectId: string,
    actorUserId: string,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMemberSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const membership = await this.memberships.findOne({
      where: {
        id: dto.membershipId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
      relations: { user: true },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found.');
    }

    const existing = await this.projectMemberships.findOne({
      where: { projectId, membershipId: dto.membershipId },
    });
    if (existing) {
      throw new ConflictException('This member is already on the project.');
    }

    const projectMembership = this.projectMemberships.create({
      projectId,
      membershipId: dto.membershipId,
      rate: dto.rate ?? null,
      role: dto.role ?? ProjectMembershipRole.MEMBER,
    });

    const saved = await this.projectMemberships
      .save(projectMembership)
      .catch((error: unknown) => {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException('This member is already on the project.');
        }
        throw error;
      });

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.member_added',
        organisationId,
        actorUserId,
        metadata: { projectId, membershipId: dto.membershipId },
      });
    });

    return this.toMemberSummary(project, { ...saved, membership });
  }

  async removeMember(
    organisationId: string,
    projectId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<void> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const projectMembership = await this.projectMemberships.findOne({
      where: { projectId, membershipId },
    });
    if (!projectMembership) {
      throw new NotFoundException('This member is not on the project.');
    }

    await this.projectMemberships.remove(projectMembership);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.member_removed',
        organisationId,
        actorUserId,
        metadata: { projectId, membershipId },
      });
    });
  }

  async updateMember(
    organisationId: string,
    projectId: string,
    membershipId: string,
    actorUserId: string,
    dto: UpdateProjectMemberDto,
  ): Promise<ProjectMemberSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const projectMembership = await this.projectMemberships.findOne({
      where: { projectId, membershipId },
      relations: { membership: { user: true } },
    });
    if (!projectMembership) {
      throw new NotFoundException('This member is not on the project.');
    }

    if (dto.role !== undefined) projectMembership.role = dto.role;
    if (dto.rate !== undefined) projectMembership.rate = dto.rate;

    const saved = await this.projectMemberships.save(projectMembership);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.member_updated',
        organisationId,
        actorUserId,
        metadata: { projectId, membershipId, role: dto.role },
      });
    });

    return this.toMemberSummary(project, saved);
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

  private assertNotArchived(project: Project): void {
    if (project.archivedAt) {
      throw new ConflictException(
        'This project is archived — unarchive it first to make changes.',
      );
    }
  }

  private toSummary(project: Project): ProjectSummary {
    return {
      id: project.id,
      name: project.name,
      client: project.client,
      description: project.description,
      colour: project.colour,
      billable: project.billable,
      rate: project.rate,
      status: project.archivedAt ? 'archived' : 'active',
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private toMemberSummary(
    project: Project,
    projectMembership: Pick<
      ProjectMembership,
      'id' | 'membershipId' | 'rate' | 'role'
    > & {
      membership: Membership;
    },
  ): ProjectMemberSummary {
    return {
      id: projectMembership.id,
      membershipId: projectMembership.membershipId,
      userId: projectMembership.membership.userId,
      email: projectMembership.membership.user.email,
      name: projectMembership.membership.user.name,
      role: projectMembership.role,
      rate: projectMembership.rate,
      effectiveRate: resolveProjectRate(project, projectMembership),
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        POSTGRES_UNIQUE_VIOLATION
    );
  }
}

function normalizeText(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
