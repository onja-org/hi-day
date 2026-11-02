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
 * Chooses which shape this installation runs in, once, at start-up.
 *
 * Dynamic because the choice decides what the container is even allowed to
 * resolve: with billing off, `BillingModule` is never imported, so
 * `TrialService` and `StripeService` are never constructed and no payment
 * configuration is read or required. Asking for them conditionally inside
 * a static module would mean constructing them in order to ignore them —
 * and `StripeService` refuses to exist without a key.
 *
 * Everything that used to inject `TrialService` or `BilledSeatsService`
 * directly now injects `ENTITLEMENTS` and imports this module instead, so
 * `organisations` and `members` no longer depend on billing at all.
 */
@Module({})
export class EntitlementsModule {
  /**
   * The one `DynamicModule` object, shared by every importer.
   *
   * Nest keys dynamic modules on object identity, so returning a fresh one
   * per call would register a separate module — and a separate
   * `Entitlements` — for each of `app`, `organisations` and `members`.
   * Harmless while both implementations are stateless, but it is three
   * answers to a question that must have one, and the first piece of state
   * anybody adds would silently not be shared.
   */
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
          // `inject` is empty for self-hosted, which is what keeps the
          // billing services out of the graph rather than merely unused.
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

  /** Lets a test re-register with a different flag. Not used in production. */
  static resetForTests(): void {
    EntitlementsModule.instance = undefined;
  }
}
