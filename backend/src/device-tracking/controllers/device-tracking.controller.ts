import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { DeviceAuthenticatedRequest } from '../../devices/device-session.guard';
import { DeviceSessionGuard } from '../../devices/device-session.guard';
import type { Membership } from '../../database/entities/membership.entity';
import { DeviceProjectMemberGuard } from '../../devices/guards/device-project-member.guard';
import { SubmitConsentDto } from '../../disclosure/dto/submit-consent.dto';
import { DeviceConsentGuard } from '../../disclosure/guards/device-consent.guard';
import type { ConsentStatus } from '../../disclosure/services/disclosure.service';
import { DisclosureService } from '../../disclosure/services/disclosure.service';
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
import { AppEventsService } from '../../app-events/services/app-events.service';
import { CreateAppEventsBatchDto } from '../../app-events/dto/create-app-events-batch.dto';
import { ActivitySamplesService } from '../../activity-samples/services/activity-samples.service';
import { CreateActivitySamplesBatchDto } from '../../activity-samples/dto/create-activity-samples-batch.dto';
import type { CaptureSettings } from '../../organisations/capture-settings';
import type { IdlePolicy } from '../../organisations/idle-policy';
import { OrganisationsService } from '../../organisations/services/organisations.service';
import { SyncUrlSessionsDto } from '../../url-sessions/dto/sync-url-sessions.dto';
import type { SyncResult } from '../../url-sessions/services/url-sessions.service';
import { UrlSessionsService } from '../../url-sessions/services/url-sessions.service';
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
    private readonly urlSessionsService: UrlSessionsService,
    private readonly appEventsService: AppEventsService,
    private readonly screenshotsService: ScreenshotsService,
    private readonly activitySamplesService: ActivitySamplesService,
    private readonly disclosureService: DisclosureService,
  ) {}

  @Get('idle-policy')
  idlePolicy(@Req() request: DeviceAuthenticatedRequest): Promise<IdlePolicy> {
    return this.organisationsService.getIdlePolicy(request.organisationId);
  }

  @Get('capture-settings')
  async captureSettings(
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<CaptureSettings & { consent: { required: boolean } }> {
    const captureSettings = await this.organisationsService.getCaptureSettings(
      request.organisationId,
    );
    const consentStatus = await this.resolveConsentStatus(
      request,
      captureSettings,
    );
    return {
      ...captureSettings,
      consent: { required: consentStatus.required },
    };
  }

  /**
   * The current disclosure text the device's user should see, if any is
   * required — deliberately ungated by DeviceConsentGuard, since the agent
   * must be able to fetch this *before* consent exists. Returns
   * `disclosureVersionId: null` when there's nothing to show (no capture
   * enabled, a capture-enabled org that hasn't published text yet, or no
   * active membership right now — see `resolveConsentStatus` below).
   */
  @Get('disclosure')
  disclosure(
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<ConsentStatus> {
    return this.resolveConsentStatus(request);
  }

  @Post('consent')
  async submitConsent(
    @Body() dto: SubmitConsentDto,
    @Req() request: DeviceAuthenticatedRequest,
  ): Promise<void> {
    const membership = await this.disclosureService.resolveActiveMembership(
      request.organisationId,
      request.userId,
    );
    await this.disclosureService.recordConsent(
      request.organisationId,
      membership.id,
      request.deviceId,
      membership.disclosureRegion,
      dto.disclosureVersionId,
      dto.decision,
      request.userId,
    );
  }

  /**
   * A Membership can go inactive (e.g. just deactivated) before its
   * Device's session is revoked — there's no push channel, so the device
   * only learns this the next time it happens to call the backend (see
   * CONTEXT.md's Device entry). Rather than let that turn into a hard 403
   * on these two read-only status endpoints (`capture-settings` previously
   * always returned 200 for any valid device session; `disclosure` is new
   * but should behave the same way for consistency), treat "no active
   * membership right now" the same as "nothing to consent to right now" —
   * the capture loop has nothing to attribute samples to in that state
   * anyway.
   */
  private async resolveConsentStatus(
    request: DeviceAuthenticatedRequest,
    captureSettings?: CaptureSettings,
  ): Promise<ConsentStatus> {
    let membership: Membership;
    try {
      membership = await this.disclosureService.resolveActiveMembership(
        request.organisationId,
        request.userId,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        return { required: false, disclosureVersionId: null, text: null };
      }
      throw error;
    }

    return this.disclosureService.getConsentStatus(
      request.organisationId,
      membership.disclosureRegion,
      request.deviceId,
      captureSettings,
    );
  }

  @Post('app-events')
  @UseGuards(DeviceConsentGuard)
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
  @UseGuards(DeviceConsentGuard)
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
  @UseGuards(DeviceConsentGuard)
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
   * The agent's entries in a window, for today's per-Project totals.
   * Switching Projects ends the previous entry (only one may be open at a
   * time), so without these totals the timer would appear to reset whenever
   * someone returned to a Project.
   *
   * `from`/`to` are caller-resolved instants, so "today" is the machine's
   * local day, not the server's.
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
