import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { ReportGroupBy, ReportRow } from '../services/reports.service';
import { ReportsService } from '../services/reports.service';

const VALID_GROUP_BY: ReportGroupBy[] = ['person', 'project'];

// Manager-facing only — a plain member has no reason to see everyone
// else's hours by person/project, same reasoning as the Members list.
@Controller('organisations/:id/reports')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  getReport(
    @Req() request: AuthenticatedRequest,
    @Query('groupBy') groupBy: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<ReportRow[]> {
    if (!VALID_GROUP_BY.includes(groupBy as ReportGroupBy)) {
      throw new BadRequestException(
        `groupBy must be one of: ${VALID_GROUP_BY.join(', ')}`,
      );
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('from and to must be valid dates.');
    }

    return this.reportsService.getReport(request.organisationId!, {
      groupBy: groupBy as ReportGroupBy,
      from: fromDate,
      to: toDate,
    });
  }
}
