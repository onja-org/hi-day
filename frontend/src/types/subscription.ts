/**
 * The paid subscription, read live from Stripe by the backend. Nothing here
 * is stored on our side: renewal state belongs to Stripe, and a copy would
 * go stale the moment somebody changes a card in its dashboard.
 */
export type CardOnFile = {
  brand: string;
  last4: string;
};

export type PaidSubscription = {
  plan: "annual" | "monthly";
  /** Stripe's own status, verbatim. */
  status: string;
  /** Auto-renew is off: access runs to `currentPeriodEnd`, then stops. */
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  /** The Stripe item quantity — the seats actually paid for. */
  seatsPaid: number;
  subscribedAt: string | null;
  card: CardOnFile | null;
  /** Stripe is retrying a failed renewal. */
  paymentFailed: boolean;
  /** Over for good — Stripe's `canceled` is terminal. Nothing to renew. */
  isEnded: boolean;
  memberCount: number;
  /** From Stripe's own invoice preview, not our arithmetic. */
  nextPaymentMinor: number | null;
  currency: string;
};

/** What a seat change costs, previewed by Stripe before anything commits. */
export type SeatChangePreview = {
  seats: number;
  proratedNowMinor: number;
  nextPaymentMinor: number;
  currentNextPaymentMinor: number;
  currency: string;
  chargedAt: string | null;
};

/** One invoice, as the Billing info page lists it. */
export type InvoiceSummary = {
  id: string;
  date: string | null;
  amountMinor: number;
  currency: string;
  status: string | null;
  /** Stripe's hosted PDF. Null until the invoice is finalised. */
  pdfUrl: string | null;
  description: string | null;
};
