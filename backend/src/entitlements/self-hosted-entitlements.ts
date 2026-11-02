import { Logger } from '@nestjs/common';
import type { Entitlements } from './entitlements';

/**
 * A self-hosted install: free forever, any team size.
 *
 * Both methods do nothing, and that is the whole feature. No trial is
 * started, so there is no Subscription row and nothing counts down — which
 * is already how the rest of the app spells "never been on a trial", so
 * every surface gets the right answer from code that existed before this
 * shape did. No seat count is reported anywhere, because nobody is charged
 * for arriving and there is no provider to tell.
 *
 * It holds no Stripe client and reads no payment configuration, which is
 * what lets the app boot with no payment provider set up at all.
 */
export class SelfHostedEntitlements implements Entitlements {
  readonly billingEnabled = false;

  private readonly logger = new Logger(SelfHostedEntitlements.name);

  startTrial(): Promise<void> {
    // Nothing to count down to.
    return Promise.resolve();
  }

  syncSeats(): Promise<void> {
    // Unlimited seats, nobody to tell.
    return Promise.resolve();
  }

  announce(): void {
    this.logger.log(
      'Billing is off: no trials, unlimited seats, no payment provider.',
    );
  }
}
