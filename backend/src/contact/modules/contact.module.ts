import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { emailTracker } from '../../common/throttler-trackers.util';
import { EmailModule } from '../../email/modules/email.module';
import {
  CONTACT_THROTTLE_LIMIT,
  CONTACT_THROTTLE_TTL_MS,
  GLOBAL_CONTACT_THROTTLE_LIMIT,
  ContactController,
} from '../controllers/contact.controller';
import { ContactService } from '../services/contact.service';

/**
 * Keyed by email: the sender has no account, and a per-IP key would be one
 * bucket for every visitor behind the proxy. (An earlier attempt read
 * `req.ips[0]`, which Express only fills in when `trust proxy` is set.)
 * `default` stays per-IP as the global ceiling behind it.
 */
@Module({
  imports: [
    EmailModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: CONTACT_THROTTLE_TTL_MS,
        limit: GLOBAL_CONTACT_THROTTLE_LIMIT,
      },
      {
        name: 'contact',
        ttl: CONTACT_THROTTLE_TTL_MS,
        limit: CONTACT_THROTTLE_LIMIT,
        getTracker: emailTracker,
      },
    ]),
  ],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
