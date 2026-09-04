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
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { UpdateProjectMemberDto } from '../dto/update-project-member.dto';
import { ProjectRoleGuard } from '../guards/project-role.guard';
import { ProjectViewGuard } from '../guards/project-view.guard';
import type {
  AssignableMemberSummary,
  ProjectDetail,
  ProjectListItem,
  ProjectMemberSummary,
  ProjectSummary,
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
  create(
    @Body() dto: CreateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectSummary> {
    return this.projectsService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
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

  @Patch(':projectId')
  @UseGuards(ProjectRoleGuard)
  update(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectSummary> {
    return this.projectsService.update(
      request.organisationId!,
      projectId,
      request.userId,
      dto,
    );
  }

  @Post(':projectId/archive')
  @UseGuards(ProjectRoleGuard)
  archive(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectSummary> {
    return this.projectsService.archive(
      request.organisationId!,
      projectId,
      request.userId,
    );
  }

  @Post(':projectId/unarchive')
  @UseGuards(ProjectRoleGuard)
  unarchive(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectSummary> {
    return this.projectsService.unarchive(
      request.organisationId!,
      projectId,
      request.userId,
    );
  }

  @Post(':projectId/members')
  @UseGuards(ProjectRoleGuard)
  addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectMemberSummary> {
    return this.projectsService.addMember(
      request.organisationId!,
      projectId,
      request.userId,
      dto,
    );
  }

  @Patch(':projectId/members/:membershipId')
  @UseGuards(ProjectRoleGuard)
  updateMember(
    @Param('projectId') projectId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateProjectMemberDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectMemberSummary> {
    return this.projectsService.updateMember(
      request.organisationId!,
      projectId,
      membershipId,
      request.userId,
      dto,
    );
  }

  @Delete(':projectId/members/:membershipId')
  @UseGuards(ProjectRoleGuard)
  removeMember(
    @Param('projectId') projectId: string,
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.projectsService.removeMember(
      request.organisationId!,
      projectId,
      membershipId,
      request.userId,
    );
  }
}
