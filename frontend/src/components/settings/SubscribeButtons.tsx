"use client";

import { useState } from "react";
import clsx from "clsx";
import { startCheckout } from "@/lib/startCheckout";
import {
  BILLING_PERIODS,
  CLOUD_BILLING_NOTE,
  CLOUD_PRICE_PER_PERSON,
  type BillingPeriod,
} from "@/lib/pricing.generated";
import { ErrorMessage } from "../ErrorMessage";

type SubscribeButtonsProps = {
  organisationId: number;
};

/**
 * Sends the admin to Stripe's own payment page. The card never touches this
 * app, so there is no form here — only the choice of how often to pay.
 */
export function SubscribeButtons({ organisationId }: SubscribeButtonsProps) {
  const [busy, setBusy] = useState<BillingPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(period: BillingPeriod): Promise<void> {
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

  return (
    <div className="mt-6 flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {BILLING_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            disabled={busy !== null}
            onClick={() => void subscribe(period)}
            className={clsx(
              "flex h-11 items-center rounded-brand-sm border-2 border-ink px-4 text-sm font-bold disabled:opacity-60",
              period === "annual" && "bg-primary text-white hover:bg-primary/90",
              period !== "annual" && "text-slate-900 hover:bg-cream",
            )}
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
