"use client";

import { useState } from "react";
import { CreditCardIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useInvoices } from "@/hooks/useInvoices";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { BillingDetailRow } from "./BillingDetailRow";
import { BillingEmailRow } from "./BillingEmailRow";
import { openBillingPortal } from "@/lib/subscriptionApi";
import { formatShortDate } from "@/lib/formatShortDate";
import { formatMoney } from "@/lib/seatPricing";
import { seatOccupancy } from "@/lib/seats";
import { ErrorMessage } from "../ErrorMessage";
import { InfoMessage } from "../InfoMessage";
import { Spinner } from "../Spinner";
import type { InvoiceSummary } from "@/types/subscription";

type BillingInfoSettingsProps = {
  organisationId: number;
};

/**
 * The payment side of billing: what card is on file, when the next charge
 * falls, and everything Stripe has invoiced.
 *
 * Managing the card and the billing email is handed to **Stripe's Customer
 * Portal** rather than rebuilt here. A card form of ours would be a second
 * Elements integration and a SetupIntent flow for a job Stripe already does
 * — with 3-D Secure, wallets and dunning recovery attached — and it is the
 * same place Stripe's own billing emails send people.
 */
export function BillingInfoSettings({
  organisationId,
}: BillingInfoSettingsProps) {
  const trialQuery = useTrialStatus(organisationId);
  const subscriptionQuery = useSubscription(organisationId);
  const invoicesQuery = useInvoices(organisationId);
  const organisationQuery = useCurrentOrganisation();
  const [opening, setOpening] = useState(false);

  async function openPortal(): Promise<void> {
    setOpening(true);
    const result = await openBillingPortal(
      organisationId,
      window.location.href,
    );
    if (!result.ok) {
      toast.error(result.message);
      setOpening(false);
      return;
    }
    // A full navigation, not a router push: Stripe's page is not ours.
    window.location.assign(result.data.url);
  }

  // Everything is still arriving. Shown rather than nothing at all: an empty
  // page reads as "you have no billing", which for a paying customer is
  // alarming and wrong.
  if (trialQuery.isLoading || subscriptionQuery.isLoading) {
    return <Loading label="Loading your billing details…" />;
  }

  if (subscriptionQuery.isError) {
    return (
      <ErrorMessage
        message={
          subscriptionQuery.error instanceof Error
            ? subscriptionQuery.error.message
            : "Could not load your billing details."
        }
      />
    );
  }

  if (trialQuery.data?.isFree) {
    return (
      <InfoMessage message="Your organisation doesn't pay for Hi Day, so there's nothing to bill and no invoices to show." />
    );
  }

  const subscription = subscriptionQuery.data;

  if (!subscription) {
    return (
      <InfoMessage message="You're on the free trial. Payment details and invoices appear here once you've subscribed." />
    );
  }

  // Cancelled or ended means there is no next date and no promise to make
  // about one, which both the date and the pill have to agree on.
  const willRenew = !subscription.cancelAtPeriodEnd && !subscription.isEnded;
  const seats = seatOccupancy(subscription.memberCount, subscription.seatsPaid);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="font-display text-xl font-extrabold tracking-heading text-primary-dark">
          Billing details
        </h2>

        <div className="mt-4 divide-y-2 divide-ink/10 rounded-brand border-2 border-ink bg-white">
          {/* First: the one line here anybody came to change. */}
          <BillingEmailRow
            organisationId={organisationId}
            billingEmail={organisationQuery.data?.billingEmail ?? null}
            fallbackEmail={organisationQuery.data?.ownerEmail ?? null}
          />

          <BillingDetailRow
            title="Payment method"
            hint="Charged each period"
            action={
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={opening}
                className="flex h-10 cursor-pointer items-center rounded-brand-sm border-2 border-ink bg-white px-3 text-sm font-bold text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
              >
                {opening ? "Opening…" : subscription.card ? "Update" : "Add"}
              </button>
            }
          >
            {subscription.card ? (
              <span className="flex items-center gap-2">
                <CreditCardIcon size={18} aria-hidden="true" className="shrink-0" />
                {subscription.card.brand} •••• {subscription.card.last4}
              </span>
            ) : (
              "No payment method on file"
            )}
          </BillingDetailRow>

          {/* The renewal promise sits with the date it is about. Auto-renew
              is not a choice offered here, so the pill reports it rather
              than offering to change it — that is the Customer Portal. */}
          <BillingDetailRow
            title="Next billing date"
            hint={willRenew ? "Renews automatically" : "This subscription will not renew"}
            action={
              <span
                className={clsx(
                  "inline-flex items-center rounded-full border-2 px-3 py-1 text-xs font-extrabold",
                  willRenew
                    ? "border-success bg-success/10 text-success"
                    : "border-ink bg-sun text-ink",
                )}
              >
                {willRenew ? "Auto-renew on" : "Auto-renew off"}
              </span>
            }
          >
            {willRenew && subscription.currentPeriodEnd
              ? formatShortDate(subscription.currentPeriodEnd)
              : "—"}
          </BillingDetailRow>

          <BillingDetailRow
            title="Seats"
            hint="Members against seats you pay for"
          >
            <span className="flex flex-wrap items-center gap-3">
              {subscription.memberCount} of {subscription.seatsPaid}
              <span className="h-3 w-32 overflow-hidden rounded-full bg-ink/10">
                <span
                  className={clsx(
                    "block h-full rounded-full",
                    seats.overBy > 0 ? "bg-sun" : "bg-primary",
                  )}
                  style={{ width: `${seats.fraction * 100}%` }}
                />
              </span>
            </span>
          </BillingDetailRow>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-extrabold tracking-heading text-primary-dark">
          Invoices
        </h2>

        {invoicesQuery.isLoading && <Loading label="Loading invoices…" />}

        {invoicesQuery.isError && (
          <div className="mt-3">
            <ErrorMessage
              message={
                invoicesQuery.error instanceof Error
                  ? invoicesQuery.error.message
                  : "Could not load your invoices."
              }
            />
          </div>
        )}

        {invoicesQuery.data?.length === 0 && (
          <p className="mt-3 text-sm text-slate-900/60">
            No invoices yet. They show up here after your first payment.
          </p>
        )}

        {invoicesQuery.data && invoicesQuery.data.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y-2 divide-ink/10 rounded-brand border-2 border-ink bg-white">
            {invoicesQuery.data.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-slate-900">
      <Spinner className="text-primary-dark" />
      {label}
    </p>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceSummary }) {
  const paid = invoice.status === "paid";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="text-sm font-bold text-slate-900">
          {invoice.date ? formatShortDate(invoice.date) : "—"}
        </p>
        {invoice.description && (
          <p className="text-xs text-slate-900/60">{invoice.description}</p>
        )}
      </div>

      <p className="font-data text-sm font-bold text-primary-dark">
        {formatMoney(invoice.amountMinor)}
      </p>

      <span
        className={clsx(
          "rounded-full border-2 border-ink px-2 py-0.5 text-xs font-extrabold",
          paid ? "bg-success/15 text-success" : "bg-sun text-ink",
        )}
      >
        {invoice.status ?? "unknown"}
      </span>

      {/* Stripe's own hosted PDF — nothing is generated here. Absent until
          the invoice is finalised, when there is no document to link to. */}
      {invoice.pdfUrl ? (
        <a
          href={invoice.pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 cursor-pointer items-center gap-1.5 rounded-brand-sm border-2 border-ink bg-white px-3 text-sm font-bold text-ink transition-colors hover:bg-cream"
        >
          <DownloadSimpleIcon size={16} aria-hidden="true" />
          Download
        </a>
      ) : (
        <span className="text-xs text-slate-900/40">No PDF yet</span>
      )}
    </li>
  );
}
