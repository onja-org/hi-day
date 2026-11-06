import { Module, type DynamicModule } from '@nestjs/common';
import { BillingModule } from '../billing/modules/billing.module';
import { BilledSeatsService } from '../billing/services/billed-seats.service';
import { TrialService } from '../billing/services/trial.service';
import { isBillingEnabled } from './billing-enabled';
import { CloudEntitlements } from './cloud-entitlements';
import { ENTITLEMENTS } from './entitlements';
import { PublicConfigController } from './public-config.controller';
import { SelfHostedEntitlements } from './self-hosted-entitlements';

/**
 * Chooses the shape once at start-up. Dynamic because with billing off
 * `BillingModule` must never be imported — `StripeService` refuses to
 * exist without a key, so it cannot be constructed just to be ignored.
 */
@Module({})
export class EntitlementsModule {
  /** Nest keys dynamic modules on object identity, so every importer must
   * get the same object or each gets its own `Entitlements`. */
  private static instance: DynamicModule | undefined;

  static register(): DynamicModule {
    if (EntitlementsModule.instance) return EntitlementsModule.instance;

    const enabled = isBillingEnabled();

    EntitlementsModule.instance = {
      module: EntitlementsModule,
      imports: enabled ? [BillingModule] : [],
      controllers: [PublicConfigController],
      providers: [
        {
          provide: ENTITLEMENTS,
          inject: enabled ? [TrialService, BilledSeatsService] : [],
          useFactory: enabled
            ? (trials: TrialService, seats: BilledSeatsService) =>
                new CloudEntitlements(trials, seats)
            : () => {
                const entitlements = new SelfHostedEntitlements();
                entitlements.announce();
                return entitlements;
              },
        },
      ],
      exports: [ENTITLEMENTS],
    };

    return EntitlementsModule.instance;
  }

  /** Lets a test re-register with a different flag. */
  static resetForTests(): void {
    EntitlementsModule.instance = undefined;
  }
}
