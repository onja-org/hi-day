"use client";

import { useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useInvoices } from "@/hooks/useInvoices";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { BillingEmailCard } from "./BillingEmailCard";
import { openBillingPortal } from "@/lib/subscriptionApi";
import { formatShortDate } from "@/lib/formatShortDate";
import { formatMoney } from "@/lib/seatPricing";
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

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="font-display text-xl font-extrabold tracking-heading text-primary-dark">
          Billing info
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <InfoCard
            title="Payment method"
            hint="The card Stripe charges each period"
            value={
              subscription.card
                ? `${subscription.card.brand} •••• ${subscription.card.last4}`
                : "No payment method on file"
            }
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
          />

          <InfoCard
            title="Next billing date"
            hint="When your next charge will occur"
            value={
              subscription.cancelAtPeriodEnd || subscription.isEnded
                ? "—"
                : subscription.currentPeriodEnd
                  ? formatShortDate(subscription.currentPeriodEnd)
                  : "—"
            }
          />

          <InfoCard
            title="Billing cycle"
            hint="Change it from the Subscription tab"
            value={subscription.plan === "annual" ? "Annual" : "Monthly"}
          />

          <InfoCard
            title="Seats"
            hint="Members against the seats you pay for"
            value={`${subscription.memberCount} of ${subscription.seatsPaid}`}
          />

          <BillingEmailCard
            organisationId={organisationId}
            billingEmail={organisationQuery.data?.billingEmail ?? null}
            fallbackEmail={organisationQuery.data?.ownerEmail ?? null}
          />
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

function InfoCard({
  title,
  hint,
  value,
  action,
}: {
  title: string;
  hint: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-brand-sm border-2 border-ink bg-white p-5">
      <h3 className="text-sm font-bold text-primary-dark">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-900/60">{hint}</p>
      <p className="mt-3 rounded-brand-sm bg-cream/60 px-3 py-2 font-data text-sm font-bold text-primary-dark">
        {value}
      </p>
      {action && <div className="mt-3 flex justify-end">{action}</div>}
    </div>
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
