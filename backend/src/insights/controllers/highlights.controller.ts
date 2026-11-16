import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { GetTimelineDto } from '../dto/get-timeline.dto';
import type { MemberHighlights } from '../services/highlights.service';
import { HighlightsService } from '../services/highlights.service';

/**
 * Insights → Highlights. Same roles and query as the other Insights pages;
 * whose data comes back is decided by `canViewMembership`.
 */
@Controller('organisations/:id/insights')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
  MembershipRole.FINANCE,
)
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Get('highlights')
  getHighlights(
    @Query() query: GetTimelineDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MemberHighlights> {
    return this.highlightsService.getHighlights(
      request.organisationId!,
      request.userId,
      query.membershipId,
      query.from,
      query.to,
    );
  }
}
