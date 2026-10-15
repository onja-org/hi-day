import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { ProjectsEnabledGuard } from '../../projects/guards/projects-enabled.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ProjectMemberGuard } from '../../projects/guards/project-member.guard';
import { ProjectRoleGuard } from '../../projects/guards/project-role.guard';
import { CreateTaskDto } from '../dto/create-task.dto';
import { SetTaskStageDto } from '../dto/set-task-stage.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import type { ProjectTasksList, TaskSummary } from '../services/tasks.service';
import { TasksService } from '../services/tasks.service';

@Controller('organisations/:id/projects/:projectId/tasks')
@UseGuards(JwtAuthGuard, ProjectsEnabledGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // Read routes: any project member (or org admin/manager) can reach these
  // — a plain assigned member needs to find and act on their own tasks.
  @Get()
  @UseGuards(ProjectMemberGuard)
  list(
    @Param('projectId') projectId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProjectTasksList> {
    return this.tasksService.list(
      request.organisationId!,
      projectId,
      request.userId,
    );
  }

  @Get(':taskId')
  @UseGuards(ProjectMemberGuard)
  findOne(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskSummary> {
    return this.tasksService.findOne(
      request.organisationId!,
      projectId,
      taskId,
      request.userId,
    );
  }

  // Create/edit stay behind the stricter project-admin gate, same as
  // managing the project itself.
  @Post()
  @UseGuards(ProjectRoleGuard)
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ task: TaskSummary; message: string }> {
    const task = await this.tasksService.create(
      request.organisationId!,
      projectId,
      request.userId,
      dto,
    );
    return { task, message: 'Task created' };
  }

  @Patch(':taskId')
  @UseGuards(ProjectRoleGuard)
  async update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ task: TaskSummary; message: string }> {
    const task = await this.tasksService.update(
      request.organisationId!,
      projectId,
      taskId,
      request.userId,
      dto,
    );
    return { task, message: 'Task updated' };
  }

  // Close/reopen use the looser member gate — TasksService itself enforces
  // that only the task's own assignee or a project admin can act.
  @Post(':taskId/close')
  @UseGuards(ProjectMemberGuard)
  async close(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ task: TaskSummary; message: string }> {
    const task = await this.tasksService.close(
      request.organisationId!,
      projectId,
      taskId,
      request.userId,
    );
    return { task, message: 'Task closed' };
  }

  // Kanban moves: same looser gate as close/reopen, same service-side rule.
  @Post(':taskId/stage')
  @UseGuards(ProjectMemberGuard)
  async setStage(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: SetTaskStageDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ task: TaskSummary; message: string }> {
    const task = await this.tasksService.setStage(
      request.organisationId!,
      projectId,
      taskId,
      request.userId,
      dto.stage,
    );
    return { task, message: 'Task moved' };
  }

  @Post(':taskId/reopen')
  @UseGuards(ProjectMemberGuard)
  async reopen(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ task: TaskSummary; message: string }> {
    const task = await this.tasksService.reopen(
      request.organisationId!,
      projectId,
      taskId,
      request.userId,
    );
    return { task, message: 'Task reopened' };
  }
}
