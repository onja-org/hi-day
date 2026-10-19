import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { TrialStatus } from '../services/trial.service';
import { TrialService } from '../services/trial.service';

/**
 * Billing is admin-only at the API, not merely hidden in the UI: a manager or
 * member has no business knowing what the organisation pays or when its trial
 * runs out, and enforcing that here means the rule holds for every future
 * client too.
 */
@Controller('organisations/:id/billing')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN)
export class BillingController {
  constructor(private readonly trialService: TrialService) {}

  @Get('trial')
  getTrial(@Req() request: AuthenticatedRequest): Promise<TrialStatus> {
    return this.trialService.getStatusOrThrow(request.organisationId!);
  }
}
