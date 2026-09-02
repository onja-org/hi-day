import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { CreateInvitationsDto } from '../dto/create-invitations.dto';
import type {
  InvitationEntryResult,
  InvitationSummary,
} from '../services/invitations.service';
import { InvitationsService } from '../services/invitations.service';

const INVITE_CREATE_THROTTLE_TTL_MS = 15 * 60 * 1000;
// A bulk request counts once regardless of how many recipients it contains.
const INVITE_CREATE_THROTTLE_LIMIT = 20;

@Controller('organisations/:id/invitations')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({
    invite: {
      limit: INVITE_CREATE_THROTTLE_LIMIT,
      ttl: INVITE_CREATE_THROTTLE_TTL_MS,
    },
  })
  create(
    @Body() dto: CreateInvitationsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<InvitationEntryResult[]> {
    return this.invitationsService.createMany(
      request.organisationId!,
      request.userId,
      dto.invitations,
    );
  }

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<InvitationSummary[]> {
    return this.invitationsService.listForOrganisation(request.organisationId!);
  }

  @Post(':invitationId/resend')
  resend(
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<InvitationEntryResult> {
    return this.invitationsService.resend(
      request.organisationId!,
      invitationId,
      request.userId,
    );
  }

  @Delete(':invitationId')
  revoke(
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.invitationsService.revoke(
      request.organisationId!,
      invitationId,
      request.userId,
    );
  }
}
