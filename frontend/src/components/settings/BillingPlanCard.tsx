"use client";

import { useState } from "react";
import Link from "next/link";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBilledSeats, billedSeatsQueryKey } from "@/hooks/useBilledSeats";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { setBilledSeats } from "@/lib/setBilledSeats";
import { hasStripeKey } from "@/lib/stripeClient";
import { PaymentModal } from "../billing/PaymentModal";
import { ErrorMessage } from "../ErrorMessage";
import { Spinner } from "../Spinner";
import { SeatChangeConfirm } from "./SeatChangeConfirm";
import { formatMoney, seatPricing } from "@/lib/seatPricing";
import {
  MAX_PURCHASABLE_SEATS,
  MIN_PURCHASABLE_SEATS,
  parseSeatInput,
  seatOccupancy,
} from "@/lib/seats";
import {
  ANNUAL_SAVING_PERCENT,
  CLOUD_PRICE_PER_PERSON,
  type BillingPeriod,
} from "@/lib/pricing.generated";

type BillingPlanCardProps = {
  organisationId: number;
  /** False once they are paying: the plan lives in the summary card above. */
  showPurchase: boolean;
  /**
   * The cycle they pay on, or null while still on a trial. Its presence is
   * what decides whether a seat change saves as they type or has to be
   * confirmed — on a trial nothing is being charged, so there is nothing to
   * confirm.
   */
  paidPlan?: "annual" | "monthly" | null;
};

/** Long enough to cover a run of stepper clicks, short enough to feel saved. */
const SAVE_DELAY_MS = 800;

/**
 * Seats and what they cost, in one card.
 *
 * Seats and price were two cards until the count stopped being a setting and
 * started being the thing you are buying: the figure you type is the figure
 * priced underneath it and the figure the card is charged for, and splitting
 * those across two boxes asked the reader to hold a number in their head.
 */
export function BillingPlanCard({
  organisationId,
  showPurchase,
  paidPlan = null,
}: BillingPlanCardProps) {
  const seatsQuery = useBilledSeats(organisationId);
  const queryClient = useQueryClient();
  const [payingOpen, setPayingOpen] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>("annual");
  /**
   * Null until somebody types, which is how the field follows the server's
   * answer without an effect copying one into the other — and without that
   * copy fighting the person mid-keystroke.
   */
  const [edited, setEdited] = useState<string | null>(null);

  const saved = seatsQuery.data?.purchasedSeats ?? null;
  const memberCount = seatsQuery.data?.memberCount ?? 0;
  const draft =
    edited ?? String(saved ?? Math.max(memberCount, MIN_PURCHASABLE_SEATS));
  const parsed = parseSeatInput(draft);

  const mutation = useMutation({
    mutationFn: (seats: number) => setBilledSeats(organisationId, seats),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setEdited(null);
      queryClient.setQueryData(billedSeatsQueryKey(organisationId), result.seats);
      void queryClient.invalidateQueries({
        queryKey: billedSeatsQueryKey(organisationId),
      });
    },
  });

  /**
   * On a trial the count persists on its own — debounced, because a run of
   * stepper clicks is one decision and would otherwise be a request each.
   *
   * Once they are paying it does not: the number is staged and
   * `SeatChangeConfirm` commits it, because this is the one control on the
   * page where a click changes an invoice, and it should not do that 800ms
   * after somebody stops fidgeting.
   */
  const save = useDebouncedCallback((seats: number) => {
    if (seats !== saved) mutation.mutate(seats);
  }, SAVE_DELAY_MS);

  function setSeats(next: string): void {
    setEdited(next);
    if (paidPlan) return;
    const value = parseSeatInput(next);
    if (value !== null) save(value);
  }

  function nudge(by: number): void {
    const from = parsed ?? saved ?? MIN_PURCHASABLE_SEATS;
    setSeats(
      String(
        Math.min(
          Math.max(from + by, MIN_PURCHASABLE_SEATS),
          MAX_PURCHASABLE_SEATS,
        ),
      ),
    );
  }

  if (seatsQuery.isLoading) {
    return (
      <section className="rounded-brand border-2 border-ink bg-white p-6 shadow-hard-sm">
        <p className="flex items-center gap-2 text-sm text-slate-900">
          <Spinner className="text-primary-dark" />
          Counting…
        </p>
      </section>
    );
  }

  if (seatsQuery.isError) {
    return (
      <section className="rounded-brand border-2 border-ink bg-white p-6 shadow-hard-sm">
        <ErrorMessage
          message={
            seatsQuery.error instanceof Error
              ? seatsQuery.error.message
              : "Could not load your seats."
          }
        />
      </section>
    );
  }

  const seats = parsed ?? Math.max(saved ?? memberCount, 1);
  const pricing = seatPricing(seats);
  const annual = period === "annual";
  const totalMinor = annual
    ? pricing.annual.totalMinor
    : pricing.monthly.totalMinor;

  return (
    <section className="rounded-brand border-2 border-ink bg-white shadow-hard-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 className="text-base font-bold text-primary-dark">Seats</h2>
          <p className="mt-1 text-sm text-slate-900/60">
            Buy for people who haven&apos;t joined yet.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="One seat fewer"
              onClick={() => nudge(-1)}
              disabled={(parsed ?? MIN_PURCHASABLE_SEATS) <= MIN_PURCHASABLE_SEATS}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-brand-sm border-2 border-ink text-slate-900 transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MinusIcon size={18} weight="bold" aria-hidden="true" />
            </button>

            <label className="sr-only" htmlFor="seat-count">
              Number of seats
            </label>
            <input
              id="seat-count"
              type="text"
              inputMode="numeric"
              value={draft}
              onChange={(event) => setSeats(event.target.value)}
              aria-invalid={parsed === null}
              className="h-11 w-20 rounded-brand-sm border-2 border-ink bg-white px-3 text-center font-data text-lg font-bold text-primary-dark focus:border-primary focus:outline-none aria-invalid:border-error"
            />

            <button
              type="button"
              aria-label="One seat more"
              onClick={() => nudge(1)}
              disabled={(parsed ?? 0) >= MAX_PURCHASABLE_SEATS}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-brand-sm border-2 border-ink text-slate-900 transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon size={18} weight="bold" aria-hidden="true" />
            </button>

            {mutation.isPending && (
              <Spinner className="ml-1 text-primary-dark" />
            )}
          </div>

          {parsed === null && (
            <p role="alert" className="mt-3 text-sm font-semibold text-error">
              Enter a whole number between {MIN_PURCHASABLE_SEATS} and{" "}
              {MAX_PURCHASABLE_SEATS.toLocaleString()}.
            </p>
          )}

          {/* Only once the staged number differs from what is paid for: the
              panel is about a change, and there is not one yet. */}
          {paidPlan && parsed !== null && parsed !== saved && (
            <SeatChangeConfirm
              organisationId={organisationId}
              seats={parsed}
              plan={paidPlan}
              confirming={mutation.isPending}
              onCancel={() => setEdited(null)}
              onConfirm={() => mutation.mutate(parsed)}
            />
          )}
        </div>

        <SeatsInUse memberCount={memberCount} purchasedSeats={saved} />
      </div>

      {showPurchase && (
        <>
          <div className="border-t-2 border-ink/10 px-6 py-6">
            <CycleToggle period={period} onChange={setPeriod} />

            <p className="mt-4 font-data text-4xl font-bold text-primary-dark">
              {formatMoney(totalMinor)}
              <span className="ml-2 font-sans text-sm font-semibold text-slate-900/60">
                {annual ? "per year" : "per month"}
              </span>
            </p>

            {/* The working, on one line: the total above is the only figure
                that matters, and this is how it was reached. */}
            <p className="mt-2 text-sm text-slate-900/60">
              {seats} {seats === 1 ? "seat" : "seats"} ×{" "}
              {CLOUD_PRICE_PER_PERSON[period]}
              {annual ? " × 12" : " per month"}
              {annual &&
                ` · you save ${formatMoney(pricing.savingPerYearMinor)} a year`}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink/10 px-6 py-5">
            <p className="max-w-xs text-sm text-slate-900/60">
              You&apos;ll be charged today, and your trial ends when you pay.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/pricing"
                className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-4 text-sm font-bold text-ink transition-colors hover:bg-cream"
              >
                See pricing
              </Link>
              {hasStripeKey() ? (
                <button
                  type="button"
                  onClick={() => setPayingOpen(true)}
                  className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white transition-transform duration-150 hover:-translate-y-0.5"
                >
                  Add payment
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="flex h-11 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white"
                >
                  Add payment
                </Link>
              )}
            </div>
          </div>
        </>
      )}

      {payingOpen && (
        <PaymentModal
          organisationId={organisationId}
          // The toggle and the counter live here, so the modal is told what
          // was chosen rather than asking again.
          period={period}
          seats={seats}
          onClose={() => setPayingOpen(false)}
        />
      )}
    </section>
  );
}

/** Annual and Monthly as one control, so the choice reads as a choice. */
function CycleToggle({
  period,
  onChange,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing cycle"
      className="inline-flex rounded-full border-2 border-ink bg-white p-1"
    >
      {(["annual", "monthly"] as const).map((option) => {
        const selected = period === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={clsx(
              "flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold transition-colors",
              selected ? "bg-primary text-white" : "text-slate-900 hover:bg-cream",
            )}
          >
            {option === "annual" ? "Annual" : "Monthly"}
            {option === "annual" && (
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-xs font-extrabold",
                  selected ? "bg-sun text-ink" : "bg-success/15 text-success",
                )}
              >
                Save ~{ANNUAL_SAVING_PERCENT}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * How full the purchase is. One bar at any scale — a row of squares read
 * well at six seats and became wallpaper at sixty, and the ratio above it
 * says the same thing in less space.
 */
function SeatsInUse({
  memberCount,
  purchasedSeats,
}: {
  memberCount: number;
  purchasedSeats: number | null;
}) {
  const { total, filled, overBy, fraction } = seatOccupancy(
    memberCount,
    purchasedSeats,
  );

  return (
    <div>
      <p className="font-data text-sm font-bold text-primary-dark">
        {memberCount} of {purchasedSeats ?? memberCount} seats in use
        {overBy > 0 && (
          <span className="ml-2 rounded-full bg-sun px-2 py-0.5 text-xs font-extrabold text-ink">
            {overBy} over
          </span>
        )}
      </p>

      <div
        role="progressbar"
        aria-label="Seats in use"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        className="mt-3 h-7 w-full overflow-hidden rounded-brand-sm border-2 border-ink bg-white"
      >
        <div
          className={clsx(
            "h-full transition-[width] duration-300",
            overBy > 0 ? "bg-sun" : "bg-primary",
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      {/* Not "covered on your next payment": an extra seat is invoiced and
          charged as the person joins, so the next payment is where it
          recurs, not where it first appears. */}
      <p className="mt-3 text-sm text-slate-900/60">
        Anyone who joins beyond your seats is charged straight away, for the
        rest of this period.
      </p>
    </div>
  );
}
