import {
  Body,
  Controller,
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
import { RoleGuard } from '../../common/guards/role.guard';
import { TimeEntrySource } from '../../database/entities/time-entry-source.enum';
import { StopTimeEntryDto } from '../dto/stop-time-entry.dto';
import { SwitchTimeEntryDto } from '../dto/switch-time-entry.dto';
import { UpdateTimeEntryDto } from '../dto/update-time-entry.dto';
import type {
  CurrentTimeEntry,
  TimeEntryListItem,
  TimeEntrySummary,
} from '../services/time-entries.service';
import { TimeEntriesService } from '../services/time-entries.service';

// Not scoped to a :projectId — these act on "whatever the caller's own
// timer is doing" rather than a specific project, so the plain org-member
// RoleGuard (any active Membership) is enough; project access for `switch`
// is checked inside the service itself, same as `start`.
@Controller('organisations/:id/time-entries')
@UseGuards(JwtAuthGuard, RoleGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  // `membershipId` is optional and defaults to the caller's own — see
  // TimeEntriesService.list for who's allowed to pass someone else's.
  // `from`/`to` are ISO instants (not bare dates) — the frontend resolves
  // what "today" etc. means in the viewer's own timezone before sending.
  @Get()
  list(
    @Query('membershipId') membershipId: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<TimeEntryListItem[]> {
    return this.timeEntriesService.list(
      request.organisationId!,
      request.userId,
      membershipId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('current')
  current(@Req() request: AuthenticatedRequest): Promise<CurrentTimeEntry> {
    return this.timeEntriesService.current(
      request.organisationId!,
      request.userId,
    );
  }

  @Post('stop')
  async stop(
    @Body() dto: StopTimeEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.stop(
      request.organisationId!,
      request.userId,
      dto.endedAt ? new Date(dto.endedAt) : undefined,
    );
    return { entry, message: 'Timer stopped' };
  }

  @Patch(':timeEntryId')
  async update(
    @Param('timeEntryId') timeEntryId: string,
    @Body() dto: UpdateTimeEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.update(
      request.organisationId!,
      request.userId,
      timeEntryId,
      dto,
    );
    return { entry, message: 'Time entry updated' };
  }

  @Post('switch')
  async switchTo(
    @Body() dto: SwitchTimeEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.switchTo(
      request.organisationId!,
      request.userId,
      dto.projectId,
      dto.taskId,
      TimeEntrySource.WEB,
      null,
    );
    return { entry, message: 'Timer switched' };
  }

  @Post('pause')
  async pause(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.pause(
      request.organisationId!,
      request.userId,
    );
    return { entry, message: 'Timer paused' };
  }

  @Post('resume')
  async resume(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ entry: TimeEntrySummary; message: string }> {
    const entry = await this.timeEntriesService.resume(
      request.organisationId!,
      request.userId,
    );
    return { entry, message: 'Timer resumed' };
  }
}
