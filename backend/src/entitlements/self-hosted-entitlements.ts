import { Logger } from '@nestjs/common';
import type { Entitlements } from './entitlements';

/**
 * A self-hosted install: free forever, any team size. Both methods doing
 * nothing is the feature — no trial row is written, so nothing counts
 * down, and no payment client exists to require configuring.
 */
export class SelfHostedEntitlements implements Entitlements {
  readonly billingEnabled = false;

  private readonly logger = new Logger(SelfHostedEntitlements.name);

  startTrial(): Promise<void> {
    return Promise.resolve();
  }

  syncSeats(): Promise<void> {
    return Promise.resolve();
  }

  announce(): void {
    this.logger.log(
      'Billing is off: no trials, unlimited seats, no payment provider.',
    );
  }
}
