import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { UpsertSavedReportDto } from '../dto/upsert-saved-report.dto';
import type { SavedReportView } from '../services/saved-reports.service';
import { SavedReportsService } from '../services/saved-reports.service';

@Controller('organisations/:id/saved-reports')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
  MembershipRole.FINANCE,
)
export class SavedReportsController {
  constructor(private readonly savedReportsService: SavedReportsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<SavedReportView[]> {
    return this.savedReportsService.list(
      request.organisationId!,
      request.userId,
    );
  }

  @Post()
  async create(
    @Body() dto: UpsertSavedReportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ report: SavedReportView; message: string }> {
    const report = await this.savedReportsService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
    return { report, message: 'Report saved' };
  }

  @Put(':savedReportId')
  async update(
    @Param('savedReportId', ParseUUIDPipe) savedReportId: string,
    @Body() dto: UpsertSavedReportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ report: SavedReportView; message: string }> {
    const report = await this.savedReportsService.update(
      request.organisationId!,
      request.userId,
      savedReportId,
      dto,
    );
    return { report, message: 'Report saved' };
  }

  @Delete(':savedReportId')
  async remove(
    @Param('savedReportId', ParseUUIDPipe) savedReportId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.savedReportsService.remove(
      request.organisationId!,
      request.userId,
      savedReportId,
    );
    return { message: 'Report deleted' };
  }
}
