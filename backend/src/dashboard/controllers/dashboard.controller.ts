import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import type { DashboardSummary } from '../services/dashboard.service';
import { DashboardService } from '../services/dashboard.service';

// Not scoped to a `membershipId` param — this is always "my own dashboard",
// same reasoning as TimeEntriesController's own-timer routes.
@Controller('organisations/:id/dashboard')
@UseGuards(JwtAuthGuard, RoleGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Req() request: AuthenticatedRequest): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(
      request.organisationId!,
      request.userId,
    );
  }
}
