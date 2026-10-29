import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { EmailModule } from '../../email/modules/email.module';
import {
  CONTACT_THROTTLE_LIMIT,
  CONTACT_THROTTLE_TTL_MS,
  ContactController,
} from '../controllers/contact.controller';
import { ContactService } from '../services/contact.service';

/**
 * By IP, because there is no session to key on — the whole point of this
 * form is that the sender has no account. `ips[0]` first so a proxy's own
 * address does not become one bucket for every visitor behind it.
 *
 * Takes the **request**, not the execution context: `getTracker` is
 * `(req, context)`, and reaching for `switchToHttp()` on the first argument
 * throws on every submission. The report tracker beside this one has the
 * signature right — this one did not.
 */
function contactTracker(req: Request): string {
  return req.ips?.[0] ?? req.ip ?? 'unknown';
}

@Module({
  imports: [
    EmailModule,
    ThrottlerModule.forRoot([
      {
        name: 'contact',
        ttl: CONTACT_THROTTLE_TTL_MS,
        limit: CONTACT_THROTTLE_LIMIT,
        getTracker: contactTracker,
      },
    ]),
  ],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
