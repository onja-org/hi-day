import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AllowSuspendedOrganisation } from '../../common/decorators/allow-suspended-organisation.decorator';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { ConfirmOrganisationDeletionDto } from '../dto/confirm-organisation-deletion.dto';
import { RequestOrganisationDeletionDto } from '../dto/request-organisation-deletion.dto';
import type { OrganisationDeletionStatus } from '../services/organisation-deletion.service';
import { OrganisationDeletionService } from '../services/organisation-deletion.service';

/**
 * Account deletion. The role check here only gets an admin through the door;
 * the *owner* check (only one admin may delete or restore the account) lives
 * in the service. Every route is allowed while the organisation is suspended,
 * since restoring it is exactly what a suspended owner needs to do.
 */
@Controller('organisations/:id/deletion')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN)
@AllowSuspendedOrganisation()
export class OrganisationDeletionController {
  constructor(private readonly deletionService: OrganisationDeletionService) {}

  @Get()
  getStatus(
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganisationDeletionStatus> {
    return this.deletionService.getStatus(
      request.organisationId!,
      request.userId,
    );
  }

  @Post('request')
  requestDeletion(
    @Body() dto: RequestOrganisationDeletionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.deletionService.requestDeletion(
      request.organisationId!,
      request.userId,
      dto,
    );
  }

  @Post('confirm')
  confirmDeletion(
    @Body() dto: ConfirmOrganisationDeletionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.deletionService.confirmDeletion(
      request.organisationId!,
      request.userId,
      dto.token,
    );
  }

  @Post('cancel')
  cancelDeletion(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.deletionService.cancelDeletion(
      request.organisationId!,
      request.userId,
    );
  }
}
