import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { GetTimelineDto } from '../dto/get-timeline.dto';
import type { MemberUnusualActivity } from '../services/unusual-activity.service';
import { UnusualActivityService } from '../services/unusual-activity.service';

/**
 * Insights → Unusual activity. Same roles and query as the other Insights
 * pages; whose data comes back is decided by `canViewMembership`.
 */
@Controller('organisations/:id/insights')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
  MembershipRole.FINANCE,
)
export class UnusualActivityController {
  constructor(
    private readonly unusualActivityService: UnusualActivityService,
  ) {}

  @Get('unusual-activity')
  getUnusualActivity(
    @Query() query: GetTimelineDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MemberUnusualActivity> {
    return this.unusualActivityService.getUnusualActivity(
      request.organisationId!,
      request.userId,
      query.membershipId,
      query.from,
      query.to,
    );
  }
}
