import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RequestInviteLinkJoinDto } from '../dto/request-invite-link-join.dto';
import type { InviteLinkPreview } from '../services/invite-links.service';
import { InviteLinksService } from '../services/invite-links.service';

const JOIN_THROTTLE_TTL_MS = 15 * 60 * 1000;
// Anonymous routes, keyed per invite link: previewing is cheap, but every
// accepted join request can send an email, so that gets a tighter budget.
const PREVIEW_THROTTLE_LIMIT = 30;
const REQUEST_THROTTLE_LIMIT = 5;
// And per email, so one link can't repeatedly mail the same person. Lower
// than the per-link limit, so for a single person this is what bites.
const REQUEST_EMAIL_THROTTLE_LIMIT = 3;
// Volume across every link at once — all a per-IP key can mean here.
const GLOBAL_PREVIEW_THROTTLE_LIMIT = 600;
const GLOBAL_REQUEST_THROTTLE_LIMIT = 200;
// Same reply whatever happened, so the endpoint can't be used to learn who
// is a member or whether an email already has an invitation.
const GENERIC_REQUEST_MESSAGE =
  "If that email can join, we've sent it an invitation. Check your inbox.";

@Controller('invite-links')
@UseGuards(ThrottlerGuard)
// `invite` keys on the authenticated inviter; nobody here is signed in yet.
@SkipThrottle({ invite: true })
export class InviteLinkJoinController {
  constructor(private readonly inviteLinksService: InviteLinksService) {}

  @Get(':token')
  @Throttle({
    default: {
      limit: GLOBAL_PREVIEW_THROTTLE_LIMIT,
      ttl: JOIN_THROTTLE_TTL_MS,
    },
    token: { limit: PREVIEW_THROTTLE_LIMIT, ttl: JOIN_THROTTLE_TTL_MS },
  })
  @SkipThrottle({ email: true })
  preview(@Param('token') token: string): Promise<InviteLinkPreview> {
    return this.inviteLinksService.getPreview(token);
  }

  @Post(':token/requests')
  @HttpCode(200)
  @Throttle({
    default: {
      limit: GLOBAL_REQUEST_THROTTLE_LIMIT,
      ttl: JOIN_THROTTLE_TTL_MS,
    },
    token: { limit: REQUEST_THROTTLE_LIMIT, ttl: JOIN_THROTTLE_TTL_MS },
    email: { limit: REQUEST_EMAIL_THROTTLE_LIMIT, ttl: JOIN_THROTTLE_TTL_MS },
  })
  async request(
    @Param('token') token: string,
    @Body() dto: RequestInviteLinkJoinDto,
  ): Promise<{ message: string }> {
    await this.inviteLinksService.requestJoin(token, dto.email);
    return { message: GENERIC_REQUEST_MESSAGE };
  }
}
