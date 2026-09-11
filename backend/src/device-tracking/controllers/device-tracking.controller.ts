import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
  TimeEntrySummary,
} from '../../time-entries/services/time-entries.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import type { ProjectTasksList } from '../../tasks/services/tasks.service';
import { TasksService } from '../../tasks/services/tasks.service';
import { AppEventsService } from '../../app-events/services/app-events.service';
import { CreateAppEventsBatchDto } from '../../app-events/dto/create-app-events-batch.dto';
import { ActivitySamplesService } from '../../activity-samples/services/activity-samples.service';
import { CreateActivitySamplesBatchDto } from '../../activity-samples/dto/create-activity-samples-batch.dto';
import type { CaptureSettings } from '../../organisations/capture-settings';
import type { IdlePolicy } from '../../organisations/idle-policy';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { CreateScreenshotDto } from '../../screenshots/dto/create-screenshot.dto';
import { RequestScreenshotUploadUrlDto } from '../../screenshots/dto/request-screenshot-upload-url.dto';
import { ScreenshotsService } from '../../screenshots/services/screenshots.service';

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
    private readonly appEventsService: AppEventsService,
    private readonly screenshotsService: ScreenshotsService,
    private readonly activitySamplesService: ActivitySamplesService,
  ) {}

  @Get('idle-policy')
  idlePolicy(@Req() request: DeviceAuthenticatedRequest): Promise<IdlePolicy> {
    return this.organisationsService.getIdlePolicy(request.organisationId);
  }

  @Get('capture-settings')
  captureSettings(
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<CaptureSettings> {
    return this.organisationsService.getCaptureSettings(request.organisationId);
  }

  @Post('app-events')
  async recordAppEvents(
    @Body() dto: CreateAppEventsBatchDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<void> {
    await this.appEventsService.recordBatch(
      request.organisationId,
      request.userId,
      request.deviceId,
      dto.events,
    );
  }

  @Post('activity-samples')
  async recordActivitySamples(
    @Body() dto: CreateActivitySamplesBatchDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<void> {
    await this.activitySamplesService.recordBatch(
      request.organisationId,
      request.userId,
      request.deviceId,
      dto.samples,
    );
  }

  @Post('screenshots/upload-url')
  requestScreenshotUploadUrl(
    @Body() dto: RequestScreenshotUploadUrlDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    return this.screenshotsService.requestUploadUrl(
      request.organisationId,
      request.deviceId,
      dto.capturedAt,
    );
  }

  @Post('screenshots')
  async recordScreenshot(
    @Body() dto: CreateScreenshotDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<void> {
    await this.screenshotsService.recordScreenshot(
      request.organisationId,
      request.userId,
      request.deviceId,
      dto.storageKey,
      dto.capturedAt,
    );
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
}
