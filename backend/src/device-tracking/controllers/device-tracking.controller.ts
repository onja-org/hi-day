import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { DeviceAuthenticatedRequest } from '../../devices/device-session.guard';
import { DeviceSessionGuard } from '../../devices/device-session.guard';
import { DeviceProjectMemberGuard } from '../../devices/guards/device-project-member.guard';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import type { ProjectListItem } from '../../projects/services/projects.service';
import { ProjectsService } from '../../projects/services/projects.service';
import { StartTimeEntryDto } from '../../time-entries/dto/start-time-entry.dto';
import { StopTimeEntryDto } from '../../time-entries/dto/stop-time-entry.dto';
import { SwitchTimeEntryDto } from '../../time-entries/dto/switch-time-entry.dto';
import type {
  CurrentTimeEntry,
  TimeEntryListItem,
  TimeEntrySummary,
} from '../../time-entries/services/time-entries.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import type { ProjectTasksList } from '../../tasks/services/tasks.service';
import { TasksService } from '../../tasks/services/tasks.service';
import type { IdlePolicy } from '../../organisations/idle-policy';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { SyncUrlSessionsDto } from '../../url-sessions/dto/sync-url-sessions.dto';
import type { SyncResult } from '../../url-sessions/services/url-sessions.service';
import { UrlSessionsService } from '../../url-sessions/services/url-sessions.service';

/**
 * The desktop agent's own read/write surface for time tracking — mirrors
 * the web routes under `organisations/:id/...` one-for-one (same
 * ProjectsService/TasksService/TimeEntriesService underneath, so the two
 * surfaces can never disagree about what's allowed), but authenticated by
 * the device's bearer token instead of a user's JWT+cookie, and with the
 * organisation implied by the device session rather than a route param.
 */
@Controller('device')
@UseGuards(DeviceSessionGuard)
export class DeviceTrackingController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly tasksService: TasksService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly organisationsService: OrganisationsService,
    private readonly urlSessionsService: UrlSessionsService,
  ) {}

  @Get('idle-policy')
  idlePolicy(@Req() request: DeviceAuthenticatedRequest): Promise<IdlePolicy> {
    return this.organisationsService.getIdlePolicy(request.organisationId);
  }

  @Get('projects')
  listProjects(
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<ProjectListItem[]> {
    return this.projectsService.listForTimeTracking(
      request.organisationId,
      request.userId,
    );
  }

  @Get('projects/:projectId/tasks')
  @UseGuards(DeviceProjectMemberGuard)
  listTasks(
    @Param('projectId') projectId: string,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<ProjectTasksList> {
    return this.tasksService.list(
      request.organisationId,
      projectId,
      request.userId,
    );
  }

  @Post('projects/:projectId/time-entries/start')
  @UseGuards(DeviceProjectMemberGuard)
  start(
    @Param('projectId') projectId: string,
    @Body() dto: StartTimeEntryDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<TimeEntrySummary> {
    return this.timeEntriesService.start(
      request.organisationId,
      request.userId,
      projectId,
      dto.taskId,
      TimeEntrySource.AGENT,
      request.deviceId,
    );
  }

  @Post('time-entries/stop')
  stop(
    @Body() dto: StopTimeEntryDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<TimeEntrySummary> {
    return this.timeEntriesService.stop(
      request.organisationId,
      request.userId,
      dto.endedAt ? new Date(dto.endedAt) : undefined,
    );
  }

  @Post('time-entries/switch')
  switchTo(
    @Body() dto: SwitchTimeEntryDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<TimeEntrySummary> {
    return this.timeEntriesService.switchTo(
      request.organisationId,
      request.userId,
      dto.projectId,
      dto.taskId,
      TimeEntrySource.AGENT,
      request.deviceId,
    );
  }

  @Get('time-entries/current')
  current(
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<CurrentTimeEntry> {
    return this.timeEntriesService.current(
      request.organisationId,
      request.userId,
    );
  }

  @Post('time-entries/pause')
  pause(@Req() request: DeviceAuthenticatedRequest): Promise<TimeEntrySummary> {
    return this.timeEntriesService.pause(
      request.organisationId,
      request.userId,
    );
  }

  @Post('time-entries/resume')
  resume(
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<TimeEntrySummary> {
    return this.timeEntriesService.resume(
      request.organisationId,
      request.userId,
    );
  }

  /**
   * The agent's own entries in a window, used to show how much has already
   * been tracked against each Project today. Mirrors the web console's
   * `organisations/:id/time-entries` exactly (same service, same role
   * gating) — the agent needs it because switching Projects necessarily
   * ENDS the previous entry: only one entry per person may be open at a
   * time (the partial unique index in CreateTimeEntries). Without today's
   * running totals the timer would appear to reset to zero every time the
   * person came back to a Project they had already worked on.
   *
   * `from`/`to` are ISO instants resolved by the caller, so "today" means
   * the machine's own local day rather than the server's.
   */
  @Get('time-entries')
  list(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<TimeEntryListItem[]> {
    return this.timeEntriesService.list(
      request.organisationId,
      request.userId,
      undefined,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Post('url-sessions/sync')
  syncUrlSessions(
    @Body() dto: SyncUrlSessionsDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<SyncResult> {
    return this.urlSessionsService.sync(
      request.organisationId,
      request.userId,
      request.deviceId,
      dto.sessions,
    );
  }
}
