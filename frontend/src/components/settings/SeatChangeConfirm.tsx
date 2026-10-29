"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/seatPricing";
import { formatShortDate } from "@/lib/formatShortDate";
import { previewSeatChange } from "@/lib/subscriptionApi";
import { BillingConsentPanel } from "../billing/BillingConsentPanel";
import { ErrorMessage } from "../ErrorMessage";
import { Spinner } from "../Spinner";
import type { SeatChangePreview } from "@/types/subscription";

type SeatChangeConfirmProps = {
  organisationId: number;
  /** The staged count. Nothing has reached Stripe yet. */
  seats: number;
  plan: "annual" | "monthly";
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
};

/**
 * What changing the seat count will cost, before it is changed.
 *
 * For a paying organisation the counter stages a number rather than saving
 * it, and this is where it commits. Every figure is Stripe's own invoice
 * preview: a total of ours that disagreed with the invoice would be worse
 * than showing none.
 */
export function SeatChangeConfirm({
  organisationId,
  seats,
  plan,
  onCancel,
  onConfirm,
  confirming,
}: SeatChangeConfirmProps) {
  /**
   * Carries the seat count it was fetched for, rather than being cleared
   * when that changes: resetting state synchronously inside the effect
   * cascades a render, and this way a figure for an old number is simply not
   * the current answer.
   */
  const [answer, setAnswer] = useState<{
    seats: number;
    preview?: SeatChangePreview;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let current = true;

    void previewSeatChange(organisationId, seats).then((result) => {
      if (!current) return;
      setAnswer(
        result.ok
          ? { seats, preview: result.data }
          : { seats, error: result.message },
      );
    });

    // Cancelled on a re-run so a slow preview cannot land after a newer one.
    return () => {
      current = false;
    };
  }, [organisationId, seats]);

  const current = answer?.seats === seats ? answer : null;
  const preview = current?.preview ?? null;
  const error = current?.error ?? null;

  const annual = plan === "annual";
  const rows = preview
    ? [
        // Only where there is something to take now: a monthly change
        // prorates nothing, and a $0.00 line invites the question of why.
        ...(preview.proratedNowMinor > 0
          ? [
              {
                label: preview.chargedAt
                  ? `Charged on ${formatShortDate(preview.chargedAt)}`
                  : "Charged now",
                value: formatMoney(preview.proratedNowMinor),
              },
            ]
          : []),
        {
          label: annual ? "Renewal" : "Next payment",
          value: `${formatMoney(preview.currentNextPaymentMinor)} → ${formatMoney(preview.nextPaymentMinor)}`,
          strong: true,
        },
      ]
    : undefined;

  return (
    <div className="mt-4">
      <BillingConsentPanel
        title={`Change to ${seats} ${seats === 1 ? "seat" : "seats"}?`}
        description={
          annual
            ? "Extra seats are billed once, for the months left in your year. No one is blocked while you decide."
            : "Extra seats are added to your next monthly payment. No one is blocked while you decide."
        }
        rows={rows}
        confirmLabel={`Confirm ${seats} seats`}
        onConfirm={onConfirm}
        onCancel={onCancel}
        busy={confirming}
        // Confirming before Stripe has answered would be agreeing to a figure
        // nobody has seen.
        confirmable={Boolean(preview)}
      >
        {error && (
          <div className="mt-3">
            <ErrorMessage message={error} />
          </div>
        )}
        {!preview && !error && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-900">
            <Spinner className="text-primary-dark" />
            Asking Stripe what this costs…
          </p>
        )}
      </BillingConsentPanel>
    </div>
  );
}
