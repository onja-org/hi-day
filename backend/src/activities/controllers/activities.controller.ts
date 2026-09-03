import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { CreateActivityDto } from '../dto/create-activity.dto';
import type { ActivityEntry } from '../services/activities.service';
import { ActivitiesService } from '../services/activities.service';

@Controller('organisations/:id/activities')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  create(
    @Body() dto: CreateActivityDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ActivityEntry> {
    return this.activitiesService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
  }

  @Get('mine')
  listMine(@Req() request: AuthenticatedRequest): Promise<ActivityEntry[]> {
    return this.activitiesService.listMine(
      request.organisationId!,
      request.userId,
    );
  }
}
