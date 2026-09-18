import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { AddProjectMemberDto } from '../dto/add-project-member.dto';
import { AddProjectTeamDto } from '../dto/add-project-team.dto';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateProjectMemberDto } from '../dto/update-project-member.dto';
import { ProjectRoleGuard } from '../guards/project-role.guard';
import { ProjectViewGuard } from '../guards/project-view.guard';
import type {
  AssignableMemberSummary,
  AssignableTeamSummary,
  ProjectDetail,
  ProjectListItem,
  ProjectMemberSummary,
  ProjectSummary,
  ProjectTeamSummary,
} from '../services/projects.service';
import { ProjectsService } from '../services/projects.service';

@Controller('organisations/:id/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // Every role can list projects — scoped per-caller inside the service
  // (admin sees all, manager/member see only projects they belong to).
  @Get()
  @UseGuards(RoleGuard)
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
  )
  list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: 'active' | 'archived',
    @Query('client') client?: string,
  ): Promise<ProjectListItem[]> {
    return this.projectsService.list(request.organisationId!, request.userId, {
      status,
      client,
    });
  }

  // Backs the time-tracking project picker (web + desktop agent): every
  // active member needs to see which projects *they* can log time
  // against, not just admins/managers — see
  // ProjectsService.listForTimeTracking.
  @Get('my-projects')
  @UseGuards(RoleGuard)
  myProjects(@Req() request: AuthenticatedRequest): Promise<ProjectListItem[]> {
    return this.projectsService.listForTimeTracking(
      request.organisationId!,
      request.userId,
    );
  }

  @Post()
  @UseGuards(RoleGuard)
  @RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
  async create(
    @Body() dto: CreateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ project: ProjectSummary; message: string }> {
    const project = await this.projectsService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
    return { project, message: 'Project created' };
  }

  // Read-only: an org admin/manager, or anyone holding a ProjectMembership
  // on this project (any role), can view it — see ProjectViewGuard.
  @Get(':projectId')
  @UseGuards(ProjectViewGuard)
  findOne(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectDetail> {
    return this.projectsService.findOne(request.organisationId!, projectId);
  }

  // Backs the "add member" picker — deliberately narrower than the org-wide
  // /memberships list (see AssignableMemberSummary), and project-scoped so
  // a project manager who is only an org "member" can use it without being
  // granted the org-wide member roster.
  @Get(':projectId/assignable-members')
  @UseGuards(ProjectRoleGuard)
  assignableMembers(
    @Req() request: AuthenticatedRequest,
  ): Promise<AssignableMemberSummary[]> {
    return this.projectsService.listAssignableMembers(request.organisationId!);
  }

  // Backs the "add team" picker, same rationale as assignable-members but
  // for AddProjectTeamDto's teamId — every Team in the org, not just ones
  // the caller belongs to (see ProjectsService.listAssignableTeams).
  @Get(':projectId/assignable-teams')
  @UseGuards(ProjectRoleGuard)
  assignableTeams(
    @Req() request: AuthenticatedRequest,
  ): Promise<AssignableTeamSummary[]> {
    return this.projectsService.listAssignableTeams(request.organisationId!);
  }

  @Patch(':projectId')
  @UseGuards(ProjectRoleGuard)
  async update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ project: ProjectSummary; message: string }> {
    const project = await this.projectsService.update(
      request.organisationId!,
      projectId,
      request.userId,
      dto,
    );
    return { project, message: 'Project updated' };
  }

  @Post(':projectId/archive')
  @UseGuards(ProjectRoleGuard)
  async archive(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ project: ProjectSummary; message: string }> {
    const project = await this.projectsService.archive(
      request.organisationId!,
      projectId,
      request.userId,
    );
    return { project, message: 'Project archived' };
  }

  @Post(':projectId/unarchive')
  @UseGuards(ProjectRoleGuard)
  async unarchive(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ project: ProjectSummary; message: string }> {
    const project = await this.projectsService.unarchive(
      request.organisationId!,
      projectId,
      request.userId,
    );
    return { project, message: 'Project unarchived' };
  }

  @Post(':projectId/members')
  @UseGuards(ProjectRoleGuard)
  async addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ member: ProjectMemberSummary; message: string }> {
    const member = await this.projectsService.addMember(
      request.organisationId!,
      projectId,
      request.userId,
      dto,
    );
    return { member, message: 'Project member added' };
  }

  @Patch(':projectId/members/:membershipId')
  @UseGuards(ProjectRoleGuard)
  async updateMember(
    @Param('projectId') projectId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateProjectMemberDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ member: ProjectMemberSummary; message: string }> {
    const member = await this.projectsService.updateMember(
      request.organisationId!,
      projectId,
      membershipId,
      request.userId,
      dto,
    );
    return { member, message: 'Project member updated' };
  }

  @Delete(':projectId/members/:membershipId')
  @UseGuards(ProjectRoleGuard)
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.projectsService.removeMember(
      request.organisationId!,
      projectId,
      membershipId,
      request.userId,
    );
    return { message: 'Project member removed' };
  }

  // Assigning/unassigning a Team grants/revokes project-MEMBER-equivalent
  // access to every Membership on that Team at once (see ProjectTeam) —
  // stays behind the same project-manager gate as adding an individual
  // member.
  @Post(':projectId/teams')
  @UseGuards(ProjectRoleGuard)
  async addTeam(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectTeamDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ team: ProjectTeamSummary; message: string }> {
    const team = await this.projectsService.addTeam(
      request.organisationId!,
      projectId,
      request.userId,
      dto,
    );
    return { team, message: 'Team added to project' };
  }

  @Delete(':projectId/teams/:teamId')
  @UseGuards(ProjectRoleGuard)
  async removeTeam(
    @Param('projectId') projectId: string,
    @Param('teamId') teamId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.projectsService.removeTeam(
      request.organisationId!,
      projectId,
      teamId,
      request.userId,
    );
    return { message: 'Team removed from project' };
  }
}
