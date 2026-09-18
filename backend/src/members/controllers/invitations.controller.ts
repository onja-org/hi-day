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
  async create(
    @Body() dto: CreateInvitationsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ results: InvitationEntryResult[]; message: string }> {
    const results = await this.invitationsService.createMany(
      request.organisationId!,
      request.userId,
      dto.invitations,
    );
    return { results, message: 'Invitations sent' };
  }

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<InvitationSummary[]> {
    return this.invitationsService.listForOrganisation(request.organisationId!);
  }

  @Post(':invitationId/resend')
  async resend(
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.invitationsService.resend(
      request.organisationId!,
      invitationId,
      request.userId,
    );
    return { message: 'Invitation resent' };
  }

  @Delete(':invitationId')
  async revoke(
    @Param('invitationId') invitationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.invitationsService.revoke(
      request.organisationId!,
      invitationId,
      request.userId,
    );
    return { message: 'Invitation revoked' };
  }
}
