"use client";

import Link from "next/link";
import { SealPercentIcon, WarningCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { settingsHref } from "@/lib/settingsNavigation";
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
  if (!trialQuery.data) {
    return null;
  }

  const { headline, detail, tone } = trialBannerCopy(trialQuery.data);
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

      <Link
        href={settingsHref(organisationId, "billing", "subscription")}
        className="flex h-11 items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90"
      >
        Add payment
      </Link>
    </aside>
  );
}
