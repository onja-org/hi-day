import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { MembershipRole } from '../../database/entities/membership-role.enum';
import { CreateInviteLinkDto } from '../dto/create-invite-link.dto';
import { UpdateInviteLinkDto } from '../dto/update-invite-link.dto';
import type { InviteLinkSummary } from '../services/invite-links.service';
import { InviteLinksService } from '../services/invite-links.service';

// Admins manage every link; managers only their own (see InviteLinksService).
@Controller('organisations/:id/invite-links')
@UseGuards(JwtAuthGuard, RoleGuard)
@RequireRole(MembershipRole.ADMIN, MembershipRole.MANAGER)
export class InviteLinksController {
  constructor(private readonly inviteLinksService: InviteLinksService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<InviteLinkSummary[]> {
    return this.inviteLinksService.list(
      request.organisationId!,
      request.userId,
    );
  }

  @Post()
  async create(
    @Body() dto: CreateInviteLinkDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ inviteLink: InviteLinkSummary; message: string }> {
    const inviteLink = await this.inviteLinksService.create(
      request.organisationId!,
      request.userId,
      dto,
    );
    return { inviteLink, message: 'Invite link created' };
  }

  @Patch(':linkId')
  async update(
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateInviteLinkDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ inviteLink: InviteLinkSummary; message: string }> {
    const inviteLink = await this.inviteLinksService.update(
      request.organisationId!,
      linkId,
      request.userId,
      dto,
    );
    return { inviteLink, message: 'Invite link updated' };
  }

  @Delete(':linkId')
  async remove(
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    await this.inviteLinksService.remove(
      request.organisationId!,
      linkId,
      request.userId,
    );
    return { message: 'Invite link deleted' };
  }
}
