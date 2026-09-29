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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { ActivityEntry } from '../../activities/services/activities.service';
import { AppEventsService } from '../../app-events/services/app-events.service';
import type { AppActivityDay } from '../../app-events/services/app-events.service';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { NoteEntry } from '../../notes/services/notes.service';
import { NotesService } from '../../notes/services/notes.service';
import type { ScreenshotSummaryItem } from '../../screenshots/services/screenshots.service';
import { ScreenshotsService } from '../../screenshots/services/screenshots.service';
import { TimeEntriesService } from '../../time-entries/services/time-entries.service';
import type { TimeEntryListItem } from '../../time-entries/services/time-entries.service';
import { UpdateMembershipDto } from '../dto/update-membership.dto';
import { SendPasswordResetsDto } from '../dto/send-password-resets.dto';
import type {
  ActiveMemberListItem,
  ActiveMemberSummary,
  PasswordResetResult,
} from '../services/memberships.service';
import { MembershipsService } from '../services/memberships.service';

// A bulk request counts once regardless of how many members it contains,
// sharing the invite-create bucket (same tracker: caller + organisation).
const PASSWORD_RESET_THROTTLE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_THROTTLE_LIMIT = 20;

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
    private readonly notesService: NotesService,
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ActiveMemberListItem[]> {
    return this.membershipsService.listActiveForOrganisation(
      request.organisationId!,
      request.userId,
    );
  }

  @Post('password-resets')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    invite: {
      limit: PASSWORD_RESET_THROTTLE_LIMIT,
      ttl: PASSWORD_RESET_THROTTLE_TTL_MS,
    },
  })
  async sendPasswordResets(
    @Body() dto: SendPasswordResetsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ results: PasswordResetResult[]; message: string }> {
    const results = await this.membershipsService.sendPasswordResets(
      request.organisationId!,
      request.userId,
      dto.membershipIds,
    );
    const sent = results.filter((result) => result.outcome === 'sent').length;
    const skipped = results.length - sent;
    const message =
      `Password reset email sent to ${sent} ${sent === 1 ? 'member' : 'members'}` +
      (skipped > 0 ? `; ${skipped} skipped` : '');
    return { results, message };
  }

  @Patch(':membershipId')
  async update(
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ member: ActiveMemberSummary; message: string }> {
    const member = await this.membershipsService.update(
      request.organisationId!,
      membershipId,
      request.userId,
      dto,
    );
    return { member, message: 'Membership updated' };
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
    @Query('projectId') projectId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<AppActivityDay> {
    return this.appEventsService.getDayForMembership(
      request.organisationId!,
      request.userId,
      membershipId,
      date,
      { projectId },
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
    @Query('projectId') projectId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ScreenshotSummaryItem[]> {
    return this.screenshotsService.getScreenshotsForMembership(
      request.organisationId!,
      request.userId,
      membershipId,
      date,
      { projectId },
    );
  }

  @Get(':membershipId/notes')
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
  )
  getNotes(
    @Param('membershipId') membershipId: string,
    @Query('date') date: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<NoteEntry[]> {
    return this.notesService.listForMembership(
      request.organisationId!,
      request.userId,
      membershipId,
      date,
    );
  }
}
