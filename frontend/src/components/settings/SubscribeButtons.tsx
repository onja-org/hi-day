"use client";

import { useState } from "react";
import { startCheckout } from "@/lib/startCheckout";
import { hasStripeKey } from "@/lib/stripeClient";
import { PaymentModal } from "../billing/PaymentModal";
import {
  CLOUD_BILLING_NOTE,
  CLOUD_PRICE_PER_PERSON,
  type BillingPeriod,
} from "@/lib/pricing.generated";
import { ErrorMessage } from "../ErrorMessage";

type SubscribeButtonsProps = {
  organisationId: number;
};

/**
 * One button into the in-app payment modal, which carries the Monthly/Annual
 * choice itself — two buttons here would ask the same question twice.
 *
 * Falls back to Stripe's hosted page where no publishable key is configured
 * (a self-hosted install), since Elements cannot draw a card field without
 * one. That path keeps the per-period buttons, because the hosted page needs
 * the choice made before it opens.
 */
export function SubscribeButtons({ organisationId }: SubscribeButtonsProps) {
  const [payingOpen, setPayingOpen] = useState(false);
  const [busy, setBusy] = useState<BillingPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribeViaHostedPage(period: BillingPeriod): Promise<void> {
    setBusy(period);
    setError(null);
    const result = await startCheckout(organisationId, period);
    if (result.ok) {
      // A full navigation, not a router push: Stripe's page is not ours.
      window.location.assign(result.url);
      return;
    }
    setError(result.message);
    setBusy(null);
  }

  if (!hasStripeKey()) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          {(["monthly", "annual"] as const).map((period) => (
            <button
              key={period}
              type="button"
              disabled={busy !== null}
              onClick={() => void subscribeViaHostedPage(period)}
              className={
                period === "annual"
                  ? "flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  : "flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink px-4 text-sm font-bold text-slate-900 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
              }
            >
              {busy === period
                ? "Opening Stripe…"
                : `Pay ${CLOUD_PRICE_PER_PERSON[period]} per person, ${CLOUD_BILLING_NOTE[period]}`}
            </button>
          ))}
        </div>
        {error && <ErrorMessage message={error} />}
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setPayingOpen(true)}
        className="flex h-11 w-fit cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90"
      >
        Add payment
      </button>

      {payingOpen && (
        <PaymentModal
          organisationId={organisationId}
          onClose={() => setPayingOpen(false)}
        />
      )}
    </div>
  );
}
