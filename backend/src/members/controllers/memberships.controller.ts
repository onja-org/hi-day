import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { ActivityEntry } from '../../activities/services/activities.service';
import { AppEventsService } from '../../app-events/services/app-events.service';
import type { AppTimeSummary } from '../../app-events/services/app-events.service';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { ScreenshotSummaryItem } from '../../screenshots/services/screenshots.service';
import { ScreenshotsService } from '../../screenshots/services/screenshots.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import type { TimeEntryListItem } from '../../time-entries/services/time-entries.service';
import { UpdateMembershipDto } from '../dto/update-membership.dto';
import type { ActiveMemberSummary } from '../services/memberships.service';
import { MembershipsService } from '../services/memberships.service';

@Controller('organisations/:id/memberships')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
export class MembershipsController {
  constructor(
    private readonly membershipsService: MembershipsService,
    private readonly activitiesService: ActivitiesService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly appEventsService: AppEventsService,
    private readonly screenshotsService: ScreenshotsService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ActiveMemberSummary[]> {
    return this.membershipsService.listActiveForOrganisation(
      request.organisationId!,
      request.userId,
    );
  }

  @Patch(':membershipId')
  update(
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ActiveMemberSummary> {
    return this.membershipsService.update(
      request.organisationId!,
      membershipId,
      request.userId,
      dto,
    );
  }

  @Get(':membershipId/activities')
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
  )
  listActivity(
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ActivityEntry[]> {
    return this.activitiesService.listForMembership(
      request.organisationId!,
      request.userId,
      membershipId,
    );
  }

  @Get(':membershipId/time-entries')
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
  )
  listTimeEntries(
    @Param('membershipId') membershipId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TimeEntryListItem[]> {
    return this.timeEntriesService.list(
      request.organisationId!,
      request.userId,
      membershipId,
    );
  }

  @Get(':membershipId/app-events/summary')
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
  )
  getAppEventsSummary(
    @Param('membershipId') membershipId: string,
    @Query('date') date: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<AppTimeSummary> {
    return this.appEventsService.getSummaryForMembership(
      request.organisationId!,
      request.userId,
      membershipId,
      date,
    );
  }

  @Get(':membershipId/screenshots')
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
  )
  getScreenshots(
    @Param('membershipId') membershipId: string,
    @Query('date') date: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ScreenshotSummaryItem[]> {
    return this.screenshotsService.getScreenshotsForMembership(
      request.organisationId!,
      request.userId,
      membershipId,
      date,
    );
  }
}
