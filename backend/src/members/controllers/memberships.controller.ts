import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActivitiesService } from '../../activities/services/activities.service';
import type { ActivityEntry } from '../../activities/services/activities.service';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
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
}
