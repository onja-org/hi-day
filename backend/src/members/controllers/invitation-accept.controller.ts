import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import type { InvitationPreview } from '../services/invitations.service';
import { InvitationsService } from '../services/invitations.service';

const TOKEN_THROTTLE_TTL_MS = 15 * 60 * 1000;
// Anonymous, token-guessing-facing routes — coarse defense-in-depth on top
// of the token's own 256-bit entropy.
const TOKEN_THROTTLE_LIMIT = 10;

@Controller('invitations')
@UseGuards(ThrottlerGuard)
@Throttle({
  default: { limit: TOKEN_THROTTLE_LIMIT, ttl: TOKEN_THROTTLE_TTL_MS },
})
export class InvitationAcceptController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitationPreview> {
    return this.invitationsService.getPreview(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    return this.invitationsService.accept(token, dto, request, response);
  }
}
