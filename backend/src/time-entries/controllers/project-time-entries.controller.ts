import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ProjectMemberGuard } from '../../projects/guards/project-member.guard';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import { CreateManualTimeEntryDto } from '../dto/create-manual-time-entry.dto';
import { StartTimeEntryDto } from '../dto/start-time-entry.dto';
import type { TimeEntrySummary } from '../services/time-entries.service';
import { TimeEntriesService } from '../services/time-entries.service';

// Starting (and manually logging a completed span) are the time-entry
// actions scoped to a specific :projectId, so they live under the
// project's own route (mirrors TasksController) and reuse
// ProjectMemberGuard — same "org admin/manager or any ProjectMembership on
// this project" rule used for viewing/closing your own tasks.
@Controller('organisations/:id/projects/:projectId/time-entries')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class ProjectTimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  async createManual(
    @Param('projectId') projectId: string,
    @Body() dto: CreateManualTimeEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.createManual(
      request.organisationId!,
      request.userId,
      projectId,
      dto,
    );
    return { entry, message: 'Time entry created' };
  }

  @Post('start')
  async start(
    @Param('projectId') projectId: string,
    @Body() dto: StartTimeEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.start(
      request.organisationId!,
      request.userId,
      projectId,
      dto.taskId,
      TimeEntrySource.WEB,
      null,
    );
    return { entry, message: 'Timer started' };
  }
}
