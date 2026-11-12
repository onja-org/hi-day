import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { GetTimelineDto } from '../dto/get-timeline.dto';
import type {
  MemberPerformanceReport,
  MemberTimeline,
} from '../services/insights.service';
import { InsightsService } from '../services/insights.service';

/**
 * Per-member Insights. Every role may call these, Finance included, so
 * everyone can see their own timeline; whose data comes back is decided in
 * the service by `canViewMembership`, like Screenshots.
 */
@Controller('organisations/:id/insights')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
  MembershipRole.FINANCE,
)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('timeline')
  getTimeline(
    @Query() query: GetTimelineDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MemberTimeline> {
    return this.insightsService.getTimeline(
      request.organisationId!,
      request.userId,
      query.membershipId,
      query.from,
      query.to,
    );
  }

  /** Same query as the Timeline: whose, and which days. */
  @Get('performance')
  getPerformance(
    @Query() query: GetTimelineDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MemberPerformanceReport> {
    return this.insightsService.getPerformance(
      request.organisationId!,
      request.userId,
      query.membershipId,
      query.from,
      query.to,
    );
  }
}
