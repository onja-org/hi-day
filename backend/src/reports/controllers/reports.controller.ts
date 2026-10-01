import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { SendReportDto } from '../dto/send-report.dto';
import { ReportsService } from '../services/reports.service';

// Sending mail to arbitrary addresses is spam-shaped, so it's rate-limited
// per caller and organisation, like invites.
const SEND_THROTTLE_TTL_MS = 15 * 60 * 1000;
const SEND_THROTTLE_LIMIT = 10;

@Controller('organisations/:id/reports')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
  MembershipRole.FINANCE,
)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('send')
  @UseGuards(ThrottlerGuard)
  @Throttle({
    send: { limit: SEND_THROTTLE_LIMIT, ttl: SEND_THROTTLE_TTL_MS },
  })
  async send(
    @Body() dto: SendReportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.reportsService.send(
      request.organisationId!,
      request.userId,
      dto,
    );
    return { message: 'Report sent' };
  }
}
