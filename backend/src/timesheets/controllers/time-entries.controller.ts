import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { CreateTimeEntryDto } from '../dto/create-time-entry.dto';
import type { TimeEntrySummary } from '../services/time-entries.service';
import { TimeEntriesService } from '../services/time-entries.service';

@Controller('organisations/:id/time-entries')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
  MembershipRole.MEMBER,
)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  create(
    @Body() dto: CreateTimeEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TimeEntrySummary> {
    return this.timeEntriesService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
  }

  @Get('mine')
  listMine(@Req() request: AuthenticatedRequest): Promise<TimeEntrySummary[]> {
    return this.timeEntriesService.listMine(
      request.organisationId!,
      request.userId,
    );
  }
}
