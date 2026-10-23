/**
 * Hi Day Cloud's advertised prices and trial length, in one place.
 *
 * The pricing page, the landing page's teaser and the in-app trial banner all
 * read these, so an amount can never be changed in one and missed in another.
 * The payment integration will need the backend to charge these same numbers;
 * lifting them somewhere both packages can import is that ticket's job, since
 * nothing server-side charges money yet.
 */

export type BillingPeriod = "monthly" | "annual";

export const BILLING_PERIODS: BillingPeriod[] = ["monthly", "annual"];

/** Per person, per month. Annual is cheaper and is the default offered. */
export const CLOUD_PRICE_PER_PERSON: Record<BillingPeriod, string> = {
  monthly: "$4",
  annual: "$3.50",
};

export const CLOUD_BILLING_NOTE: Record<BillingPeriod, string> = {
  monthly: "billed monthly",
  annual: "billed annually",
};

/** What the trial promises, and how long it actually runs for. */
export const TRIAL_DAYS = 14;
export const TRIAL_PROMISE = "14-day free trial, no credit card required.";
