import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { UpsertTimesheetReasonDto } from '../dto/upsert-timesheet-reason.dto';
import type { TimesheetReasonSummary } from '../services/timesheet-reasons.service';
import { TimesheetReasonsService } from '../services/timesheet-reasons.service';

/**
 * The Organisation's Reasons list. Reading is open to every role — the
 * add/edit/delete-time pickers need it, and a plain member uses those —
 * while changing the list stays admin-only, like the rest of Settings.
 */
@Controller('organisations/:id/timesheet-reasons')
@UseGuards(JwtAuthGuard, RoleGuard)
export class TimesheetReasonsController {
  constructor(
    private readonly timesheetReasonsService: TimesheetReasonsService,
  ) {}

  @Get()
  @RequireRole(
    MembershipRole.ADMIN,
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
    MembershipRole.FINANCE,
  )
  list(
    @Req() request: AuthenticatedRequest,
  ): Promise<TimesheetReasonSummary[]> {
    return this.timesheetReasonsService.list(request.organisationId!);
  }

  @Post()
  @RequireRole(MembershipRole.ADMIN)
  async create(
    @Body() dto: UpsertTimesheetReasonDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ reason: TimesheetReasonSummary; message: string }> {
    const reason = await this.timesheetReasonsService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
    return { reason, message: 'Reason added' };
  }

  @Patch(':reasonId')
  @RequireRole(MembershipRole.ADMIN)
  async rename(
    @Param('reasonId') reasonId: string,
    @Body() dto: UpsertTimesheetReasonDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ reason: TimesheetReasonSummary; message: string }> {
    const reason = await this.timesheetReasonsService.rename(
      request.organisationId!,
      request.userId,
      reasonId,
      dto,
    );
    return { reason, message: 'Reason updated' };
  }

  @Delete(':reasonId')
  @RequireRole(MembershipRole.ADMIN)
  async remove(
    @Param('reasonId') reasonId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.timesheetReasonsService.remove(
      request.organisationId!,
      request.userId,
      reasonId,
    );
    return { message: 'Reason deleted' };
  }
}
