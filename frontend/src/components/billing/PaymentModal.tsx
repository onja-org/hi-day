"use client";

import { useState } from "react";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { LockSimpleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../Modal";
import { ErrorMessage } from "../ErrorMessage";
import { getStripe } from "@/lib/stripeClient";
import { createSubscriptionIntent } from "@/lib/createSubscriptionIntent";
import { useBilledSeats } from "@/hooks/useBilledSeats";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { trialStatusQueryKey } from "@/hooks/useTrialStatus";
import { formatMoney, nextPaymentFrom, seatPricing } from "@/lib/seatPricing";
import { formatShortDate } from "@/lib/formatShortDate";
import { cardElementStyle } from "./cardElementStyle";
import { type BillingPeriod } from "@/lib/pricing.generated";

type PaymentModalProps = {
  organisationId: number | string;
  onClose: () => void;
  /**
   * The cycle chosen on the Billing page. **The single source of truth** —
   * the modal shows it and confirms with it, and never offers a different
   * one, so the Stripe price can only ever be the one on screen.
   *
   * Optional for the one opener that has no toggle to read: the trial
   * banner, which appears on every page. Missing means annual, the default
   * the Billing page itself leads with.
   */
  period?: BillingPeriod;
  /** Seats chosen on the Billing page. Missing falls back to what is on record. */
  seats?: number;
};

/**
 * Takes a card without leaving the app.
 *
 * It decides nothing about what is being bought. The cycle and the seat
 * count arrive as props from the Billing page, which owns both controls;
 * this used to repeat the cycle choice as its own radios, which meant two
 * places could disagree about what was about to be charged.
 *
 * The card never reaches this app — Elements posts it straight to Stripe
 * from inside its own iframe — so this is the same security posture as the
 * hosted page, with the form drawn here instead.
 */
export function PaymentModal({
  organisationId,
  onClose,
  period: chosenPeriod,
  seats: chosenSeats,
}: PaymentModalProps) {
  const seatsQuery = useBilledSeats(organisationId);
  const organisationQuery = useCurrentOrganisation();

  // Read only to stand in for a caller that has no counter of its own. A
  // caller that passes seats wins, always.
  const period: BillingPeriod = chosenPeriod ?? "annual";
  const seats = Math.max(
    chosenSeats ??
      seatsQuery.data?.purchasedSeats ??
      seatsQuery.data?.memberCount ??
      1,
    1,
  );

  const pricing = seatPricing(seats);
  const annual = period === "annual";
  const totalMinor = annual
    ? pricing.annual.totalMinor
    : pricing.monthly.totalMinor;
  const seatLabel = `${seats} ${seats === 1 ? "seat" : "seats"}`;

  // Shown before there is a subscription to read a period end off. The
  // server returns its own figure with the intent, and that is the one the
  // confirmation repeats.
  const nextPaymentAt = nextPaymentFrom(new Date(), period);

  /**
   * The individual card Elements are confirmed against a client secret
   * directly, so the group needs nothing but the fonts its fields render in.
   * No `appearance` either: it does not reach them (see `cardElementStyle`).
   */
  const options: StripeElementsOptions = {};

  return (
    <Modal title="Add payment" onClose={onClose}>
      <p className="-mt-4 text-sm text-slate-900/60">
        {annual ? "Billed annually" : "Billed monthly"} · {seatLabel}
      </p>

      {/* One cycle, one total. Nothing about the cycle they did not choose —
          no rival total and no saving to compare against, because the choice
          has already been made on the Billing page and repeating it here only
          invites the two to disagree. */}
      <dl className="flex flex-col gap-2 rounded-brand-sm border-2 border-ink bg-white p-4 text-sm">
        {annual ? (
          <>
            <Row
              label={`${seatLabel} × ${formatMoney(pricing.annual.perSeatPerMonthMinor)} × 12 months`}
              value={formatMoney(pricing.annual.totalMinor)}
            />
            <Row
              label="That works out to"
              value={`${formatMoney(pricing.annual.perMonthMinor)} / month`}
            />
          </>
        ) : (
          <Row
            label={`${seatLabel} × ${formatMoney(pricing.monthly.perSeatMinor)} per month`}
            value={formatMoney(pricing.monthly.totalMinor)}
          />
        )}

        <div className="mt-1 border-t-2 border-ink/10 pt-2">
          {/* Charged now, in full: paying ends the trial today and starts the
              paid period from today, so there is no trial-end date to show. */}
          <Row strong label="Charged today" value={formatMoney(totalMinor)} />
        </div>
        <Row label="Next payment" value={formatShortDate(nextPaymentAt)} />
      </dl>

      <Elements stripe={getStripe()} options={options}>
        <CardDetails
          organisationId={organisationId}
          period={period}
          seats={seats}
          billingEmail={organisationQuery.data?.billingEmail ?? undefined}
          onClose={onClose}
        />
      </Elements>
    </Modal>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={clsx(strong ? "font-bold text-primary-dark" : "text-slate-900/60")}>
        {label}
      </dt>
      <dd
        className={clsx(
          "font-data",
          strong ? "font-bold text-primary-dark" : "text-slate-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Our own label over a Stripe-owned input. */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-bold text-slate-900"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * The box each card field sits in. The field itself is a Stripe iframe that
 * only renders text, so every visible edge — border, radius, padding, focus
 * ring — belongs out here (see `cardElementStyle`).
 */
const FIELD_BOX =
  "rounded-brand-sm border-2 border-ink bg-white px-3 py-3 transition-colors focus-within:border-primary";

function CardDetails({
  organisationId,
  period,
  seats,
  billingEmail,
  onClose,
}: {
  organisationId: number | string;
  period: BillingPeriod;
  /** Sent with the confirm, so the charge matches the summary above. */
  seats: number;
  billingEmail?: string;
  onClose: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nameMissing = cardholderName.trim() === "";

  async function confirm(): Promise<void> {
    if (!stripe || !elements) return;

    // Required rather than optional: a cardholder name is what some issuers
    // check the authorisation against, and an empty one reads to them as a
    // mismatch rather than as nothing supplied.
    if (nameMissing) {
      setError("Enter the name on the card.");
      return;
    }

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) return;

    setBusy(true);
    setError(null);

    const created = await createSubscriptionIntent(
      organisationId,
      period,
      seats,
    );
    if (!created.ok) {
      setError(created.message);
      toast.error(created.message);
      setBusy(false);
      return;
    }

    // One card, given to whichever intent the backend raised: a SetupIntent
    // while the trial still has days to run (store it, charge nothing) and a
    // PaymentIntent once there is money to take. Stripe reads expiry and CVC
    // from the sibling Elements automatically — only the number is passed.
    const paymentMethod = {
      card: cardNumber,
      billing_details: {
        name: cardholderName.trim(),
        ...(billingEmail ? { email: billingEmail } : {}),
      },
    };

    // Always a charge, never a card merely stored: paying ends the trial
    // there and then and takes the full amount today, so there is no
    // SetupIntent branch left to pick between.
    const confirmed = await stripe.confirmCardPayment(
      created.intent.clientSecret,
      { payment_method: paymentMethod },
    );

    if (confirmed.error) {
      // Stripe localises the common decline codes itself; the fallback
      // covers the rest, which have no customer-facing wording.
      const message = confirmed.error.message ?? "Your card was not accepted.";
      setError(message);
      toast.error(message);
      setBusy(false);
      return;
    }

    toast.success(
      `Payment confirmed — your subscription is active. Next payment ${formatShortDate(created.intent.nextPaymentAt)}.`,
    );
    void queryClient.invalidateQueries({
      queryKey: trialStatusQueryKey(organisationId),
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-primary-dark">Card details</h3>

      <Field label="Cardholder name" htmlFor="cardholder-name">
        <input
          id="cardholder-name"
          type="text"
          autoComplete="cc-name"
          placeholder="Name on card"
          value={cardholderName}
          onChange={(event) => setCardholderName(event.target.value)}
          className="h-12 rounded-brand-sm border-2 border-ink bg-white px-3 text-base text-ink placeholder:text-slate-900/40 focus:border-primary focus:outline-none"
        />
      </Field>

      <Field label="Card number">
        <div className={FIELD_BOX}>
          <CardNumberElement
            options={{ style: cardElementStyle, showIcon: true }}
            onChange={(event) => {
              if (event.error) setError(event.error.message);
              else setError(null);
            }}
          />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Expiry date">
          <div className={FIELD_BOX}>
            <CardExpiryElement options={{ style: cardElementStyle }} />
          </div>
        </Field>
        <Field label="CVC">
          <div className={FIELD_BOX}>
            <CardCvcElement options={{ style: cardElementStyle }} />
          </div>
        </Field>
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-900/60">
        <LockSimpleIcon size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        Payments are processed securely by Stripe. We never see or store your
        card details.
      </p>

      {error && <ErrorMessage message={error} />}

      <div className="flex justify-end gap-3 border-t-2 border-ink/10 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-5 text-sm font-bold text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy || !stripe}
          className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-5 text-sm font-bold text-white shadow-hard-sm transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
        >
          {busy ? "Confirming…" : "Confirm payment"}
        </button>
      </div>
    </div>
  );
}
