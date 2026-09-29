import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RequestInviteLinkJoinDto } from '../dto/request-invite-link-join.dto';
import type { InviteLinkPreview } from '../services/invite-links.service';
import { InviteLinksService } from '../services/invite-links.service';

const JOIN_THROTTLE_TTL_MS = 15 * 60 * 1000;
// Anonymous routes: previewing is cheap, but every accepted join request
// can send an email, so it gets a much tighter per-IP budget.
const PREVIEW_THROTTLE_LIMIT = 30;
const REQUEST_THROTTLE_LIMIT = 5;
// Same reply whatever happened, so the endpoint can't be used to learn who
// is a member or whether an email already has an invitation.
const GENERIC_REQUEST_MESSAGE =
  "If that email can join, we've sent it an invitation. Check your inbox.";

@Controller('invite-links')
@UseGuards(ThrottlerGuard)
export class InviteLinkJoinController {
  constructor(private readonly inviteLinksService: InviteLinksService) {}

  @Get(':token')
  @Throttle({
    default: { limit: PREVIEW_THROTTLE_LIMIT, ttl: JOIN_THROTTLE_TTL_MS },
  })
  preview(@Param('token') token: string): Promise<InviteLinkPreview> {
    return this.inviteLinksService.getPreview(token);
  }

  @Post(':token/requests')
  @HttpCode(200)
  @Throttle({
    default: { limit: REQUEST_THROTTLE_LIMIT, ttl: JOIN_THROTTLE_TTL_MS },
  })
  async request(
    @Param('token') token: string,
    @Body() dto: RequestInviteLinkJoinDto,
  ): Promise<{ message: string }> {
    await this.inviteLinksService.requestJoin(token, dto.email);
    return { message: GENERIC_REQUEST_MESSAGE };
  }
}
