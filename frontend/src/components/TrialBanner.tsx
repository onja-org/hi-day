"use client";

import Link from "next/link";
import { SealPercentIcon, WarningCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { trialBannerCopy } from "@/lib/trialBannerCopy";

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

  // No banner while it loads, for a non-admin, or for an organisation that
  // predates trials — and none on failure either: a billing notice nobody
  // asked for is not worth an error message across every page.
  // Nothing to count down for an organisation that never pays, so no banner
  // on any page — a payment prompt it can never act on is pure noise.
  // Once paying, only one thing is worth a banner: the paid plan has ended
  // and the grace days are running. Hiding it for every paid organisation
  // used to mean somebody whose plan ran out was never told on any page.
  const trial = trialQuery.data?.trial;
  if (
    !trial ||
    trialQuery.data?.isFree ||
    (trial.isPaid && !trial.isInPaidGrace)
  ) {
    return null;
  }

  const { headline, detail, tone } = trialBannerCopy(trial);
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

      {/* To the Billing page rather than straight into the card form, so the
          plan, billing cycle and seat count are in front of them before they
          pay. Its own "Add payment" or "Resume subscription" takes it from
          there. */}
      <Link
        href={`/organisations/${organisationId}/settings/billing/subscription`}
        className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90"
      >
        {trial.isPaid ? "Resume subscription" : "Add payment"}
      </Link>
    </aside>
  );
}
