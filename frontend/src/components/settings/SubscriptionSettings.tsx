"use client";

import Link from "next/link";

import { useTrialStatus } from "@/hooks/useTrialStatus";
import {
  CLOUD_BILLING_NOTE,
  CLOUD_PRICE_PER_PERSON,
  TRIAL_DAYS,
} from "@/lib/pricing";
import { ErrorMessage } from "../ErrorMessage";
import { Spinner } from "../Spinner";
import { TrialSummary } from "./TrialSummary";

type SubscriptionSettingsProps = {
  organisationId: number;
};

/**
 * Where the trial banner's "Add payment" leads. Payment itself is the next
 * ticket, so this says plainly what the trial is and what it will cost rather
 * than offering a button that does nothing.
 */
export function SubscriptionSettings({
  organisationId,
}: SubscriptionSettingsProps) {
  const trialQuery = useTrialStatus(organisationId);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-brand-sm border-2 border-ink bg-white p-6">
        <h2 className="text-base font-semibold text-primary-dark">Your plan</h2>

        {trialQuery.isLoading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-900">
            <Spinner className="text-primary-dark" />
            Loading your subscription…
          </p>
        )}

        {trialQuery.isError && (
          <div className="mt-3">
            <ErrorMessage
              message={
                trialQuery.error instanceof Error
                  ? trialQuery.error.message
                  : "Could not load your subscription."
              }
            />
          </div>
        )}

        {trialQuery.data?.trial && !trialQuery.data.isFree && (
          <TrialSummary trial={trialQuery.data.trial} />
        )}

        {trialQuery.data?.isFree && (
          <p className="mt-1 text-sm text-slate-900/60">
            Your organisation doesn&apos;t pay for Hi Day. There&apos;s nothing
            running out and nothing to set up.
          </p>
        )}

        {trialQuery.isSuccess &&
          !trialQuery.data?.trial &&
          !trialQuery.data?.isFree && (
            <p className="mt-1 text-sm text-slate-900/60">
              Your organisation isn&apos;t on a plan. It was created before the
              {" "}
              {TRIAL_DAYS}-day free trial existed, so there&apos;s nothing
              running out and nothing to pay.
            </p>
          )}
      </section>

      {!trialQuery.data?.isFree && (
        <section className="rounded-brand-sm border-2 border-ink bg-white p-6">
        <h2 className="text-base font-semibold text-primary-dark">
          Hi Day Cloud pricing
        </h2>
        <p className="mt-1 text-sm text-slate-900/60">
          Every feature, every team, one price per person.
        </p>

        <dl className="mt-4 flex flex-wrap gap-8">
          <div>
            <dt className="text-sm text-slate-900/60">
              {CLOUD_BILLING_NOTE.annual}
            </dt>
            <dd className="font-data text-2xl font-bold text-primary-dark">
              {CLOUD_PRICE_PER_PERSON.annual}
              <span className="text-sm font-normal text-slate-900/60">
                {" "}
                per person / month
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-slate-900/60">
              {CLOUD_BILLING_NOTE.monthly}
            </dt>
            <dd className="font-data text-2xl font-bold text-primary-dark">
              {CLOUD_PRICE_PER_PERSON.monthly}
              <span className="text-sm font-normal text-slate-900/60">
                {" "}
                per person / month
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-slate-900/60">
          Adding a payment method isn&apos;t available yet. Nothing is locked
          while we finish it — your team keeps every feature, and you
          won&apos;t be charged without choosing a plan first.
        </p>

        <Link
          href="/pricing"
          className="mt-4 inline-flex h-11 items-center rounded-brand-sm border-2 border-ink bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90"
        >
          See pricing
        </Link>
        </section>
      )}
    </div>
  );
}
