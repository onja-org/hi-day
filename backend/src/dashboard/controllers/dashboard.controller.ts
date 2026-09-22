import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { DashboardSummary } from '../services/dashboard.service';
import { DashboardService } from '../services/dashboard.service';
import type { TeamDashboardSummary } from '../services/team-dashboard.service';
import { TeamDashboardService } from '../services/team-dashboard.service';

@Controller('organisations/:id/dashboard')
@UseGuards(JwtAuthGuard, RoleGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly teamDashboardService: TeamDashboardService,
  ) {}

  // Not scoped to a `membershipId` param — this is always "my own
  // dashboard", same reasoning as TimeEntriesController's own-timer routes.
  @Get('summary')
  getSummary(@Req() request: AuthenticatedRequest): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(
      request.organisationId!,
      request.userId,
    );
  }

  // The "All" tab — org-wide for admins, team-scoped for managers (see
  // TeamDashboardService). Plain members never reach this: RequireRole
  // rejects before the service is even called.
  @Get('team-summary')
  @RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
  getTeamSummary(
    @Req() request: AuthenticatedRequest,
  ): Promise<TeamDashboardSummary> {
    return this.teamDashboardService.getSummary(
      request.organisationId!,
      request.userId,
    );
  }
}
