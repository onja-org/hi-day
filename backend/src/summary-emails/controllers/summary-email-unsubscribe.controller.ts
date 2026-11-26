import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UnsubscribeSummaryEmailDto } from '../dto/unsubscribe-summary-email.dto';
import { SummaryEmailPreferencesService } from '../services/summary-email-preferences.service';
import type { SummaryEmailKind } from '../../organisations/summary-emails';

export const UNSUBSCRIBE_THROTTLE_TTL_MS = 10 * 60 * 1000;
/** Per token: a person clicking twice is fine; a script is not. */
export const UNSUBSCRIBE_THROTTLE_LIMIT = 10;
/** Across every token — all a per-IP key can mean behind the proxy. */
export const GLOBAL_UNSUBSCRIBE_THROTTLE_LIMIT = 300;

/**
 * Deliberately outside the auth guards: the link in a summary email must
 * work without signing in. The signed token stands in for a session, and
 * it can only switch one email off.
 */
@Controller('summary-emails/unsubscribe')
export class SummaryEmailUnsubscribeController {
  constructor(
    private readonly preferencesService: SummaryEmailPreferencesService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: {
      limit: GLOBAL_UNSUBSCRIBE_THROTTLE_LIMIT,
      ttl: UNSUBSCRIBE_THROTTLE_TTL_MS,
    },
    unsubscribe: {
      limit: UNSUBSCRIBE_THROTTLE_LIMIT,
      ttl: UNSUBSCRIBE_THROTTLE_TTL_MS,
    },
  })
  unsubscribe(
    @Body() dto: UnsubscribeSummaryEmailDto,
  ): Promise<{ kind: SummaryEmailKind; organisationName: string }> {
    return this.preferencesService.unsubscribe(dto.token);
  }
}
