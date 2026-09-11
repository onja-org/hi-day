import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { AppTimeSummary } from '../services/app-events.service';
import { AppEventsService } from '../services/app-events.service';

@Controller('organisations/:id/app-events')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
export class AppEventsController {
  constructor(private readonly appEventsService: AppEventsService) {}

  @Get('summary/mine')
  getMySummary(
    @Query('date') date: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<AppTimeSummary> {
    return this.appEventsService.getMySummary(
      request.organisationId!,
      request.userId,
      date,
    );
  }
}
