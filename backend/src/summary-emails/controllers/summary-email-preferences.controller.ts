import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { UpdateSummaryEmailPreferenceDto } from '../dto/update-summary-email-preference.dto';
import {
  SummaryEmailPreferencesService,
  type SummaryEmailPreference,
} from '../services/summary-email-preferences.service';

/**
 * The caller's own summary emails in this Organisation. Any active member —
 * no role required — and only ever their own Membership: what an admin
 * sets for someone else lives on the memberships routes.
 */
@Controller('organisations/:id/summary-emails/me')
@UseGuards(JwtAuthGuard, RoleGuard)
export class SummaryEmailPreferencesController {
  constructor(
    private readonly preferencesService: SummaryEmailPreferencesService,
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<SummaryEmailPreference[]> {
    return this.preferencesService.getOwn(
      request.organisationId!,
      request.userId,
    );
  }

  @Patch()
  update(
    @Body() dto: UpdateSummaryEmailPreferenceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SummaryEmailPreference[]> {
    return this.preferencesService.setOwn(
      request.organisationId!,
      request.userId,
      dto.kind,
      dto.enabled,
    );
  }
}
