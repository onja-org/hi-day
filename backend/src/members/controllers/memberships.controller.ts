import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { UpdateMembershipDto } from '../dto/update-membership.dto';
import type { ActiveMemberSummary } from '../services/memberships.service';
import { MembershipsService } from '../services/memberships.service';

@Controller('organisations/:id/memberships')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ActiveMemberSummary[]> {
    return this.membershipsService.listActiveForOrganisation(
      request.organisationId!,
    );
  }

  @Patch(':membershipId')
  update(
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMembershipDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ActiveMemberSummary> {
    return this.membershipsService.update(
      request.organisationId!,
      membershipId,
      request.userId,
      dto,
    );
  }
}
