"use client";

import { useState } from "react";
import Link from "next/link";
import { SealPercentIcon, WarningCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { trialBannerCopy } from "@/lib/trialBannerCopy";
import { hasStripeKey } from "@/lib/stripeClient";
import { PaymentModal } from "./billing/PaymentModal";

type TrialBannerProps = {
  organisationId: number;
};

/**
 * How long is left on the trial, and the way to pay for the product — shown
 * on every page so an admin who never opens the dashboard still sees it.
 *
 * Admins only: the hook does not even make the request for anyone else, and
 * the endpoint behind it is admin-only, so a manager or member is never
 * prompted about money. There is no dismiss — the banner expires on its own
 * in 14 days, and it carries the only route to subscribing.
 */
export function TrialBanner({ organisationId }: TrialBannerProps) {
  const trialQuery = useTrialStatus(organisationId);
  const [payingOpen, setPayingOpen] = useState(false);

  // No banner while it loads, for a non-admin, or for an organisation that
  // predates trials — and none on failure either: a billing notice nobody
  // asked for is not worth an error message across every page.
  // Nothing to count down for an organisation that never pays, so no banner
  // on any page — a payment prompt it can never act on is pure noise.
  // Nothing to count down once they are paying, on any page: the banner is
  // about a trial running out, and theirs ended the day they paid.
  if (
    !trialQuery.data?.trial ||
    trialQuery.data.isFree ||
    trialQuery.data.trial.isPaid
  ) {
    return null;
  }

  const { headline, detail, tone } = trialBannerCopy(trialQuery.data.trial);
  const Icon = tone === "urgent" ? WarningCircleIcon : SealPercentIcon;

  return (
    <aside
      aria-label="Free trial"
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-4 py-3 sm:px-6",
        tone === "calm" && "bg-cream",
        tone === "urgent" && "bg-sun",
      )}
    >
      <p className="flex items-center gap-2 text-sm text-slate-900">
        <Icon size={20} weight="bold" aria-hidden="true" className="shrink-0 text-primary-dark" />
        <span>
          <span className="font-semibold text-primary-dark">{headline}</span>{" "}
          <span className="text-slate-900/70">{detail}</span>
        </span>
      </p>

      {/* Takes the card here rather than sending them to the pricing page to
          start again. Falls back to that page where no publishable key is
          configured, since the modal could not draw a card field at all. */}
      {hasStripeKey() ? (
        <button
          type="button"
          onClick={() => setPayingOpen(true)}
          className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90"
        >
          Add payment
        </button>
      ) : (
        <Link
          href="/pricing"
          className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90"
        >
          Add payment
        </Link>
      )}

      {payingOpen && (
        <PaymentModal
          organisationId={organisationId}
          onClose={() => setPayingOpen(false)}
        />
      )}
    </aside>
  );
}
