import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import type { BilledSeats } from '../services/billed-seats.service';
import { BilledSeatsService } from '../services/billed-seats.service';
import type { TrialStatus } from '../services/trial.service';
import { TrialService } from '../services/trial.service';

/**
 * Admin-only at the API, not merely hidden in the UI, so the rule holds for
 * every future client too.
 */
@Controller('organisations/:id/billing')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN)
export class BillingController {
  constructor(
    private readonly trialService: TrialService,
    private readonly billedSeatsService: BilledSeatsService,
  ) {}

  /**
   * `trial: null` for an Organisation created before trials existed — a
   * normal state, not a failure, so it answers 200 rather than a 404 the UI
   * would have to render as an error.
   *
   * `isFree` is read from configuration and wins over any trial: an
   * Organisation that never pays has nothing counting down, whatever its
   * subscription row says.
   */
  /** Who the Organisation pays for, and how many — the same query for both. */
  @Get('seats')
  getSeats(@Req() request: AuthenticatedRequest): Promise<BilledSeats> {
    return this.billedSeatsService.forOrganisation(request.organisationId!);
  }

  @Get('trial')
  async getTrial(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ trial: TrialStatus | null; isFree: boolean }> {
    return {
      trial: await this.trialService.findStatus(request.organisationId!),
      isFree: this.trialService.isFree(Number(request.params.id)),
    };
  }
}
