import {
  Body,
  Controller,
  Get,
  HttpCode,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { SetWorkLabelDto } from '../dto/set-work-label.dto';
import type { WorkUsageItem } from '../services/work-classification.service';
import { WorkClassificationService } from '../services/work-classification.service';

/** Labelling apps and websites as core or non-core work — admin-only, like the rest of Settings. */
@Controller('organisations/:id/work-classification')
@UseGuards(JwtAuthGuard, RoleGuard)
export class WorkClassificationController {
  constructor(
    private readonly workClassificationService: WorkClassificationService,
  ) {}

  @Get()
  @RequireRole(MembershipRole.ADMIN)
  list(@Req() request: AuthenticatedRequest): Promise<WorkUsageItem[]> {
    return this.workClassificationService.listUsage(request.organisationId!);
  }

  @Put()
  @HttpCode(204)
  @RequireRole(MembershipRole.ADMIN)
  setLabel(
    @Body() dto: SetWorkLabelDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.workClassificationService.setLabel(
      request.organisationId!,
      dto,
    );
  }
}
