"use client";

import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { TRIAL_DAYS } from "@/lib/pricing.generated";
import { BillingPlanCard } from "./BillingPlanCard";
import { TrialCard } from "./TrialCard";
import { SubscriptionCard } from "./SubscriptionCard";
import { PricingLargeTeam } from "../pricing/PricingLargeTeam";
import { ErrorMessage } from "../ErrorMessage";
import { Spinner } from "../Spinner";

type SubscriptionSettingsProps = {
  organisationId: number;
};

/**
 * Billing, top to bottom: what you're on, how many seats you've bought, and
 * what each way of paying costs.
 *
 * Ordered as the questions arrive — "how long have I got", then "how many am
 * I buying", then "what does that cost" — because the third answer depends on
 * the second, and showing a price before the seat count makes it a number out
 * of nowhere.
 */
export function SubscriptionSettings({
  organisationId,
}: SubscriptionSettingsProps) {
  const trialQuery = useTrialStatus(organisationId);
  const subscriptionQuery = useSubscription(organisationId);

  const isFree = trialQuery.data?.isFree ?? false;

  return (
    <div className="flex flex-col gap-6">
      {/* No heading of its own: the settings layout's SettingsHeader already
          renders "Billing" as the page h1, and a second one would be both a
          duplicate and an accessibility fault. This is only its subtitle. */}
      <p className="-mt-2 text-sm text-slate-900/60">
        Every feature, every team, one price per person.
      </p>

      {/* A paid organisation needs both answers before anything can be drawn,
          so the spinner waits for the subscription too. Rendering nothing
          while it arrives reads as "you have no subscription", which for
          somebody who has just paid is alarming and wrong. */}
      {(trialQuery.isLoading || subscriptionQuery.isLoading) && (
        <p className="flex items-center gap-2 text-sm text-slate-900">
          <Spinner className="text-primary-dark" />
          Loading your subscription…
        </p>
      )}

      {trialQuery.isError && (
        <ErrorMessage
          message={
            trialQuery.error instanceof Error
              ? trialQuery.error.message
              : "Could not load your subscription."
          }
        />
      )}

      {/* One switch, on the status rather than on dates: a paying
          organisation sees its subscription, a trialing one sees its trial,
          and neither surface has to re-decide which it is. */}
      {/* One switch, on the status rather than on dates. A paid organisation
          gets the live Stripe view; a trialing one gets its countdown. */}
      {trialQuery.data?.trial &&
        !isFree &&
        (trialQuery.data.trial.isPaid ? (
          subscriptionQuery.data ? (
            <SubscriptionCard
              organisationId={organisationId}
              subscription={subscriptionQuery.data}
            />
          ) : subscriptionQuery.isLoading ? null : (
            /* Paid here, but Stripe has nothing to show — a webhook that
               never landed, or a subscription since deleted. Says so rather
               than leaving the page blank. */
            <ErrorMessage message="We can't reach your subscription in Stripe right now. Your access is unaffected; try again shortly." />
          )
        ) : (
          <TrialCard trial={trialQuery.data.trial} />
        ))}

      {isFree && (
        <section className="rounded-brand border-2 border-ink bg-white p-6 shadow-hard-sm">
          <h2 className="text-base font-bold text-primary-dark">Your plan</h2>
          <p className="mt-1 text-sm text-slate-900/60">
            Your organisation doesn&apos;t pay for Hi Day. There&apos;s nothing
            running out and nothing to set up.
          </p>
        </section>
      )}

      {trialQuery.isSuccess && !trialQuery.data?.trial && !isFree && (
        <section className="rounded-brand border-2 border-ink bg-white p-6 shadow-hard-sm">
          <h2 className="text-base font-bold text-primary-dark">Your plan</h2>
          <p className="mt-1 text-sm text-slate-900/60">
            Your organisation isn&apos;t on a plan. It was created before the{" "}
            {TRIAL_DAYS}-day free trial existed, so there&apos;s nothing
            running out and nothing to pay.
          </p>
        </section>
      )}

      {/* An organisation that never pays is billed for nobody, so a seat
          count and a price are both just wrong numbers. */}
      {!isFree && (
        <>
          {/* Seats stay editable once paying; the price and "Add payment"
              do not — the summary card above is their plan, and offering to
              pay again is asking them to pay twice. */}
          <BillingPlanCard
            organisationId={organisationId}
            showPurchase={!trialQuery.data?.trial?.isPaid}
            paidPlan={subscriptionQuery.data?.plan ?? null}
          />
          <PricingLargeTeam />
        </>
      )}
    </div>
  );
}
