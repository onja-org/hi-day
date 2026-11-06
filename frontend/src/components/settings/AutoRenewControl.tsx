"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSetAutoRenew } from "@/hooks/useSetAutoRenew";
import { formatShortDate } from "@/lib/formatShortDate";
import { renewalAction } from "@/lib/renewalAction";
import type { PaidSubscription } from "@/types/subscription";
import { PaymentModal } from "../billing/PaymentModal";
import { ConfirmDialog } from "../ConfirmDialog";

type AutoRenewControlProps = {
  organisationId: number | string;
  subscription: PaidSubscription;
  /** Whether the paid period plus its grace days is still running — the
   * server's billing status says. */
  hasAccess: boolean;
};

/**
 * "Cancel subscription", and "Resume subscription" to undo it — until the
 * grace days after the period end run out. Cancelling only stops the next
 * renewal: Stripe ends the subscription at the period end, and everyone
 * keeps access until then and through the grace days (see CONTEXT.md,
 * Auto-renew).
 */
export function AutoRenewControl({
  organisationId,
  subscription,
  hasAccess,
}: AutoRenewControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const mutation = useSetAutoRenew(organisationId);
  const action = renewalAction(subscription, hasAccess);
  if (!action) return null;

  const periodEnd = subscription.currentPeriodEnd
    ? formatShortDate(subscription.currentPeriodEnd)
    : "the end of the period you've paid for";

  function change(on: boolean): void {
    mutation.mutate(on, {
      onSuccess: (result) => {
        setConfirming(false);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(
          on
            ? `Subscription resumed. It renews on ${periodEnd}.`
            : `Your subscription won't renew. Everyone keeps access until ${periodEnd}.`,
        );
      },
      onError: () => toast.error("Something went wrong. Please try again."),
    });
  }

  if (action === "cancel") {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-cream"
        >
          Cancel subscription
        </button>
        {confirming && (
          <ConfirmDialog
            title="Cancel your subscription?"
            message={`It won't renew, and nothing more will be charged. Everyone in your organisation keeps full access until ${periodEnd}.\n\nChanged your mind? Choose Resume subscription on this page.`}
            confirmLabel="Cancel subscription"
            cancelLabel="Keep subscription"
            isDangerous
            isPending={mutation.isPending}
            onConfirm={() => change(false)}
            onClose={() => setConfirming(false)}
          />
        )}
      </>
    );
  }

  // `resume` turns renewal back on; `renew` (it has ended) can only start a
  // new subscription, so it takes a payment — same plan, seats on record.
  return (
    <>
      <button
        type="button"
        onClick={() => (action === "resume" ? change(true) : setPaying(true))}
        disabled={mutation.isPending}
        className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Resume subscription
      </button>
      {paying && (
        <PaymentModal
          organisationId={organisationId}
          period={subscription.plan}
          onClose={() => setPaying(false)}
        />
      )}
    </>
  );
}
