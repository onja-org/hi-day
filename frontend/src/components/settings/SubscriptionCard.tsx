"use client";

import { useState } from "react";
import { ArrowsClockwiseIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatShortDate } from "@/lib/formatShortDate";
import { formatMoney } from "@/lib/seatPricing";
import { autoRenewCopy } from "@/lib/autoRenewCopy";
import { setAutoRenew, switchCycle } from "@/lib/subscriptionApi";
import { subscriptionQueryKey } from "@/hooks/useSubscription";
import type { PaidSubscription } from "@/types/subscription";

type SubscriptionCardProps = {
  organisationId: number;
  subscription: PaidSubscription;
};

/**
 * What a paying organisation is on.
 *
 * Every figure comes from Stripe — the status, the period end, whether
 * auto-renew is on, the card, and the next payment from Stripe's own invoice
 * preview. None of it is stored or recalculated here, so the page cannot
 * disagree with the invoice.
 */
export function SubscriptionCard({
  organisationId,
  subscription,
}: SubscriptionCardProps) {
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const { line, action } = autoRenewCopy(subscription);
  const other = subscription.plan === "annual" ? "monthly" : "annual";

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: subscriptionQueryKey(organisationId),
    });

  const renew = useMutation({
    mutationFn: (on: boolean) => setAutoRenew(organisationId, on),
    onSuccess: (result, on) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(on ? "Auto-renew is back on." : "Auto-renew is off.");
      void refresh();
    },
  });

  const cycle = useMutation({
    mutationFn: () => switchCycle(organisationId, other),
    onSuccess: (result) => {
      setSwitching(false);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Switched to ${other} billing.`);
      void refresh();
    },
  });

  return (
    <section className="rounded-brand border-2 border-ink bg-white p-6 shadow-hard-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusPill subscription={subscription} />
          <h2 className="mt-3 font-display text-2xl font-extrabold tracking-heading text-primary-dark">
            {subscription.plan === "annual" ? "Annual" : "Monthly"} plan
          </h2>
        </div>

        {/* Stripe's own preview of the next invoice, never our arithmetic. */}
        {subscription.nextPaymentMinor !== null && (
          <div className="rounded-brand-sm border-2 border-ink bg-cream px-4 py-3">
            <p className="text-xs font-semibold text-slate-900/70">
              Next payment ·{" "}
              {subscription.currentPeriodEnd
                ? formatShortDate(subscription.currentPeriodEnd)
                : "—"}
            </p>
            <p className="font-data text-2xl font-bold text-primary-dark">
              {formatMoney(subscription.nextPaymentMinor)}
            </p>
            <p className="text-xs text-slate-900/60">
              {subscription.seatsPaid}{" "}
              {subscription.seatsPaid === 1 ? "seat" : "seats"}
            </p>
          </div>
        )}
      </div>

      {/* Nothing to renew, switch or turn back on: Stripe's `canceled` is
          terminal, so the only honest action is subscribing again. */}
      {subscription.isEnded ? (
        <p className="mt-5 rounded-brand-sm border-2 border-ink bg-sun px-4 py-3 text-sm text-slate-900">
          <strong>This subscription has ended.</strong>{" "}
          {subscription.currentPeriodEnd
            ? `It ran until ${formatShortDate(subscription.currentPeriodEnd)}.`
            : ""}{" "}
          Subscribing again starts a new one.
        </p>
      ) : (
      <div
        className={clsx(
          "mt-5 flex flex-wrap items-center justify-between gap-3 rounded-brand-sm border-2 px-4 py-3 text-sm",
          subscription.cancelAtPeriodEnd
            ? "border-ink bg-sun"
            : "border-volt-tint bg-volt-tint/40",
        )}
      >
        <p className="flex items-center gap-2 text-slate-900">
          <ArrowsClockwiseIcon size={16} aria-hidden="true" className="shrink-0" />
          {line}
        </p>
        <button
          type="button"
          onClick={() => renew.mutate(action === "turn-on")}
          disabled={renew.isPending}
          className="cursor-pointer text-sm font-bold text-primary-dark underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action === "turn-on" ? "Turn on auto-renew" : "Turn off auto-renew"}
        </button>
      </div>
      )}

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t-2 border-ink/10 pt-4">
        <dl className="flex flex-wrap gap-8 text-sm">
          <div>
            <dt className="text-slate-900/60">Subscribed</dt>
            <dd className="font-bold text-slate-900">
              {subscription.subscribedAt
                ? formatShortDate(subscription.subscribedAt)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-900/60">Payment method</dt>
            <dd className="font-bold text-slate-900">
              {subscription.card
                ? `${subscription.card.brand} •••• ${subscription.card.last4}`
                : "None on file"}
            </dd>
          </div>
        </dl>

        {subscription.isEnded ? null : switching ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-900/70">
              Switch to {other}? Stripe prorates the difference.
            </p>
            <button
              type="button"
              onClick={() => setSwitching(false)}
              className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-4 text-sm font-bold text-ink hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => cycle.mutate()}
              disabled={cycle.isPending}
              className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cycle.isPending ? "Switching…" : `Confirm ${other}`}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSwitching(true)}
            className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-4 text-sm font-bold text-ink transition-colors hover:bg-cream"
          >
            Switch to {other}
          </button>
        )}
      </div>

      {subscription.paymentFailed && (
        <p className="mt-4 rounded-brand-sm border-2 border-ink bg-sun px-4 py-3 text-sm text-slate-900">
          <strong>Payment failed.</strong> Stripe will keep retrying your card.
          Update it to avoid losing access when the period ends.
        </p>
      )}
    </section>
  );
}

function StatusPill({ subscription }: { subscription: PaidSubscription }) {
  const trouble = subscription.paymentFailed || subscription.isEnded;
  const Icon = trouble ? WarningCircleIcon : CheckCircleIcon;
  return (
    <p
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold",
        trouble ? "bg-sun text-ink" : "bg-success/15 text-success",
      )}
    >
      <Icon size={14} weight="bold" aria-hidden="true" />
      {subscription.isEnded
        ? "Ended"
        : subscription.paymentFailed
          ? "Payment failed"
          : "Active"}
    </p>
  );
}
