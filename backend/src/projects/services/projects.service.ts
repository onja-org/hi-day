import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, QueryFailedError, Repository } from 'typeorm';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { Membership } from '../../database/entities/membership.entity';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { MembershipStatus } from '../../database/entities/membership-status.enum';
import { Project } from '../../database/entities/project.entity';
import { ProjectColour } from '../../database/entities/project-colour.enum';
import { ProjectMembership } from '../../database/entities/project-membership.entity';
import { ProjectMembershipRole } from '../../database/entities/project-membership-role.enum';
import { ProjectTeam } from '../../database/entities/project-team.entity';
import { Task } from '../../database/entities/task.entity';
import { Team } from '../../database/entities/team.entity';
import { TeamMembership } from '../../database/entities/team-membership.entity';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import { AddProjectMemberDto } from '../dto/add-project-member.dto';
import { AddProjectTeamDto } from '../dto/add-project-team.dto';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateProjectMemberDto } from '../dto/update-project-member.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const ORG_WIDE_ROLES = [MembershipRole.ADMIN, MembershipRole.MANAGER];

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  colour: ProjectColour;
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
}

export interface ProjectTeamSummary {
  id: string;
  teamId: string;
  name: string;
}

export interface ProjectDetail extends ProjectSummary {
  members: ProjectMemberSummary[];
  teams: ProjectTeamSummary[];
}

export interface ProjectListItem extends ProjectSummary {
  taskCount: number;
}

/** A Projects-page row: a list item plus who's assigned to it, so the
 * table can show member/team avatars without a detail fetch per row. */
export interface ProjectOverviewItem extends ProjectListItem {
  members: ProjectMemberSummary[];
  teams: ProjectTeamSummary[];
}

export interface TimeTrackingProjectListItem extends ProjectListItem {
  /** Whether the caller may attribute a manually-logged entry on this
   * Project to someone other than themselves — an org admin/manager, or a
   * project-level `manager` ProjectMembership (see CONTEXT.md's Project
   * membership role entry: a project role only ever *adds* access, never
   * restricts an org admin/manager). Lets the frontend show/hide the "log
   * time for" picker per project without re-deriving the rule itself. */
  canLogTimeForOthers: boolean;
}

export interface ListProjectsFilter {
  status?: 'active' | 'archived';
}

export interface AssignableMemberSummary {
  id: string;
  userId: string;
  email: string;
  name: string | null;
}

export interface AssignableTeamSummary {
  id: string;
  name: string;
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
    @InjectRepository(ProjectTeam)
    private readonly projectTeams: Repository<ProjectTeam>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TeamMembership)
    private readonly teamMemberships: Repository<TeamMembership>,
    @InjectRepository(Membership)
    private readonly memberships: Repository<Membership>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly timeEntriesService: TimeEntriesService,
  ) {}

  /**
   * The projects a caller can track time against: every active Project for
   * an org admin/manager, or just the ones they hold a ProjectMembership on
   * (directly, or via a Team assigned to the Project — see ProjectTeam)
   * otherwise — mirrors the access rule TimeEntriesService.start enforces,
   * so this list never shows a project that starting a timer would then
   * reject.
   */
  async listForTimeTracking(
    organisationId: string,
    userId: string,
  ): Promise<TimeTrackingProjectListItem[]> {
    const membership = await this.memberships.findOne({
      where: { userId, organisationId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You do not have the required role for this organisation.',
      );
    }

    let projects: Project[];
    let managerProjectIds = new Set<string>();
    const isOrgWide = ORG_WIDE_ROLES.includes(membership.role);
    if (isOrgWide) {
      projects = await this.projects.find({
        where: { organisationId, archivedAt: IsNull() },
        order: { name: 'ASC' },
      });
    } else {
      const accessible = await this.getProjectsAccessibleTo(membership.id);
      projects = accessible.projects;
      managerProjectIds = accessible.managerProjectIds;
    }

    const taskCounts = await this.getTaskCounts(projects.map((p) => p.id));
    return projects.map((project) => ({
      ...this.toSummary(project),
      taskCount: taskCounts.get(project.id) ?? 0,
      canLogTimeForOthers: isOrgWide || managerProjectIds.has(project.id),
    }));
  }

  async list(
    organisationId: string,
    callerUserId: string,
    filter: ListProjectsFilter,
  ): Promise<ProjectOverviewItem[]> {
    const caller = await this.memberships.findOne({
      where: {
        userId: callerUserId,
        organisationId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!caller) {
      throw new NotFoundException('Membership not found.');
    }

    const query = this.projects
      .createQueryBuilder('project')
      .where('project.organisationId = :organisationId', { organisationId });

    if (caller.role !== MembershipRole.ADMIN) {
      // LeftJoin both access paths (direct ProjectMembership, or via a Team
      // assigned to the project — ProjectTeam) and OR them together, rather
      // than innerJoin-ing either alone, since a caller only needs one of
      // the two to see the project.
      query
        .leftJoin(
          'project.memberships',
          'callerMembership',
          'callerMembership.membershipId = :callerMembershipId',
          { callerMembershipId: caller.id },
        )
        .leftJoin('project.projectTeams', 'callerProjectTeam')
        .leftJoin('callerProjectTeam.team', 'callerProjectTeamTeam')
        .leftJoin(
          'callerProjectTeamTeam.teamMemberships',
          'callerTeamMembership',
          'callerTeamMembership.membershipId = :callerMembershipId',
          { callerMembershipId: caller.id },
        )
        .andWhere(
          '(callerMembership.id IS NOT NULL OR callerTeamMembership.id IS NOT NULL)',
        )
        // A caller who belongs to more than one Team assigned to the same
        // project would otherwise get one joined row per matching Team.
        .distinct(true);
    }

    if (filter.status === 'active') {
      query.andWhere('project.archivedAt IS NULL');
    } else if (filter.status === 'archived') {
      query.andWhere('project.archivedAt IS NOT NULL');
    }

    query.orderBy('project.name', 'ASC');

    const projects = await query.getMany();
    const projectIds = projects.map((p) => p.id);
    const taskCounts = await this.getTaskCounts(projectIds);
    const assignments = await this.getAssignments(projectIds);

    return projects.map((project) => ({
      ...this.toSummary(project),
      taskCount: taskCounts.get(project.id) ?? 0,
      members: assignments.members.get(project.id) ?? [],
      teams: assignments.teams.get(project.id) ?? [],
    }));
  }

  /** Every listed project's members and teams from one query each, grouped
   * by project — same batching reason as getTaskCounts. */
  private async getAssignments(projectIds: string[]): Promise<{
    members: Map<string, ProjectMemberSummary[]>;
    teams: Map<string, ProjectTeamSummary[]>;
  }> {
    const members = new Map<string, ProjectMemberSummary[]>();
    const teams = new Map<string, ProjectTeamSummary[]>();
    if (projectIds.length === 0) {
      return { members, teams };
    }

    const projectMemberships = await this.projectMemberships.find({
      where: { projectId: In(projectIds) },
      relations: { membership: { user: true } },
      order: { createdAt: 'ASC' },
    });
    for (const pm of projectMemberships) {
      const list = members.get(pm.projectId) ?? [];
      list.push(this.toMemberSummary(pm));
      members.set(pm.projectId, list);
    }

    const projectTeams = await this.projectTeams.find({
      where: { projectId: In(projectIds) },
      relations: { team: true },
      order: { createdAt: 'ASC' },
    });
    for (const pt of projectTeams) {
      const list = teams.get(pt.projectId) ?? [];
      list.push(this.toProjectTeamSummary(pt));
      teams.set(pt.projectId, list);
    }

    return { members, teams };
  }

  /**
   * Every active Project a non-org-wide Membership can reach: one it holds
   * a ProjectMembership on directly, plus one reached via any Team the
   * Membership belongs to that's been assigned to the Project (ProjectTeam)
   * — see CONTEXT.md's Project membership entry for why the two are
   * equivalent grants.
   */
  private async getProjectsAccessibleTo(
    membershipId: string,
  ): Promise<{ projects: Project[]; managerProjectIds: Set<string> }> {
    const projectMemberships = await this.projectMemberships.find({
      where: { membershipId },
      relations: { project: true },
    });

    const teamMemberships = await this.teamMemberships.find({
      where: { membershipId },
    });
    const teamIds = teamMemberships.map((tm) => tm.teamId);
    const projectTeams = teamIds.length
      ? await this.projectTeams.find({
          where: { teamId: In(teamIds) },
          relations: { project: true },
        })
      : [];

    const projectsById = new Map<string, Project>();
    // Team-derived access carries no role tier of its own — only a direct
    // ProjectMembership's `manager` role counts toward "can log time for
    // others" (see TimeTrackingProjectListItem's own comment).
    const managerProjectIds = new Set<string>();
    for (const pm of projectMemberships) {
      projectsById.set(pm.project.id, pm.project);
      if (pm.role === ProjectMembershipRole.MANAGER) {
        managerProjectIds.add(pm.project.id);
      }
    }
    for (const pt of projectTeams) projectsById.set(pt.project.id, pt.project);

    const projects = Array.from(projectsById.values())
      .filter((project) => !project.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { projects, managerProjectIds };
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
   * — a project manager who is only an org "member" shouldn't see the whole
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

  /**
   * Backs the "add team" picker — every Team in the Organisation, since a
   * project manager delegating access to a whole Team needs to see all of
   * them, not just ones they happen to belong to.
   */
  async listAssignableTeams(
    organisationId: string,
  ): Promise<AssignableTeamSummary[]> {
    const teams = await this.teams.find({
      where: { organisationId },
      order: { name: 'ASC' },
    });

    return teams.map((team) => ({ id: team.id, name: team.name }));
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

    const teams = await this.projectTeams.find({
      where: { projectId },
      relations: { team: true },
      order: { createdAt: 'ASC' },
    });

    return {
      ...this.toSummary(project),
      members: members.map((projectMembership) =>
        this.toMemberSummary(projectMembership),
      ),
      teams: teams.map((projectTeam) => this.toProjectTeamSummary(projectTeam)),
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

    const memberIds = (dto.members ?? []).map((member) => member.membershipId);
    if (memberIds.length > 0) {
      const count = await this.memberships.count({
        where: {
          id: In(memberIds),
          organisationId,
          status: MembershipStatus.ACTIVE,
        },
      });
      if (count !== new Set(memberIds).size) {
        throw new NotFoundException('One or more members were not found.');
      }
    }

    const teamIds = dto.teamIds ?? [];
    if (teamIds.length > 0) {
      const count = await this.teams.count({
        where: { id: In(teamIds), organisationId },
      });
      if (count !== new Set(teamIds).size) {
        throw new NotFoundException('One or more teams were not found.');
      }
    }

    const project = this.projects.create({
      organisationId,
      name: dto.name,
      description: normalizeText(dto.description),
      colour: dto.colour ?? ProjectColour.BLUE,
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
      if (dto.members?.length) {
        await manager.getRepository(ProjectMembership).insert(
          dto.members.map((member) => ({
            projectId: saved.id,
            membershipId: member.membershipId,
            role: member.role ?? ProjectMembershipRole.MEMBER,
          })),
        );
      }
      if (teamIds.length > 0) {
        await manager
          .getRepository(ProjectTeam)
          .insert(teamIds.map((teamId) => ({ projectId: saved.id, teamId })));
      }
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
    if (dto.description !== undefined)
      project.description = normalizeText(dto.description);
    if (dto.colour !== undefined) project.colour = dto.colour;

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

    return this.toMemberSummary({ ...saved, membership });
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

    const saved = await this.projectMemberships.save(projectMembership);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.member_updated',
        organisationId,
        actorUserId,
        metadata: { projectId, membershipId, role: dto.role },
      });
    });

    return this.toMemberSummary(saved);
  }

  /**
   * Assigns a whole Team to the project (see ProjectTeam) — every current
   * and future member of that Team gains project-MEMBER-equivalent access,
   * as an alternative to adding each Membership individually via addMember.
   */
  async addTeam(
    organisationId: string,
    projectId: string,
    actorUserId: string,
    dto: AddProjectTeamDto,
  ): Promise<ProjectTeamSummary> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const team = await this.teams.findOne({
      where: { id: dto.teamId, organisationId },
    });
    if (!team) {
      throw new NotFoundException('Team not found.');
    }

    const existing = await this.projectTeams.findOne({
      where: { projectId, teamId: dto.teamId },
    });
    if (existing) {
      throw new ConflictException('This team is already on the project.');
    }

    const projectTeam = this.projectTeams.create({
      projectId,
      teamId: dto.teamId,
    });

    const saved = await this.projectTeams
      .save(projectTeam)
      .catch((error: unknown) => {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException('This team is already on the project.');
        }
        throw error;
      });

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.team_added',
        organisationId,
        actorUserId,
        metadata: { projectId, teamId: dto.teamId },
      });
    });

    return this.toProjectTeamSummary({ ...saved, team });
  }

  async removeTeam(
    organisationId: string,
    projectId: string,
    teamId: string,
    actorUserId: string,
  ): Promise<void> {
    const project = await this.getProjectOrThrow(organisationId, projectId);
    this.assertNotArchived(project);

    const projectTeam = await this.projectTeams.findOne({
      where: { projectId, teamId },
    });
    if (!projectTeam) {
      throw new NotFoundException('This team is not on the project.');
    }

    await this.projectTeams.remove(projectTeam);

    await this.dataSource.transaction(async (manager) => {
      await this.auditLogService.record(manager, {
        action: 'project.team_removed',
        organisationId,
        actorUserId,
        metadata: { projectId, teamId },
      });
    });
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
      description: project.description,
      colour: project.colour,
      status: project.archivedAt ? 'archived' : 'active',
      archivedAt: project.archivedAt,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private toMemberSummary(
    projectMembership: Pick<
      ProjectMembership,
      'id' | 'membershipId' | 'role'
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
    };
  }

  private toProjectTeamSummary(
    projectTeam: Pick<ProjectTeam, 'id' | 'teamId'> & { team: Team },
  ): ProjectTeamSummary {
    return {
      id: projectTeam.id,
      teamId: projectTeam.teamId,
      name: projectTeam.team.name,
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
