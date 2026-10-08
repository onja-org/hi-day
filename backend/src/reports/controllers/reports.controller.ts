import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { SendReportDto } from '../dto/send-report.dto';
import type {
  ManualTimeEditRow,
  ManualTimeEditsScope,
} from '../services/manual-time-edits.service';
import { ManualTimeEditsService } from '../services/manual-time-edits.service';
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
  constructor(
    private readonly reportsService: ReportsService,
    private readonly manualTimeEditsService: ManualTimeEditsService,
  ) {}

  // `from`/`to` are ISO instants, resolved by the frontend in the report's
  // timezone, like the time-entries listing.
  @Get('manual-time-edits')
  manualTimeEdits(
    @Query('scope') scope: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ManualTimeEditRow[]> {
    const fromDate = new Date(from ?? '');
    const toDate = new Date(to ?? '');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid dates.');
    }
    const resolvedScope: ManualTimeEditsScope = scope === 'all' ? 'all' : 'me';
    return this.manualTimeEditsService.list(
      request.organisationId!,
      request.userId,
      resolvedScope,
      fromDate,
      toDate,
    );
  }

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
