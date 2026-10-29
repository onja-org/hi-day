/**
 * Mirrors the backend's `SubscriptionStatus`: whether a payment has ever
 * succeeded. Separate from Stripe's own word for how collection is going,
 * which arrives as `stripeStatus`.
 */
export type SubscriptionStatus = "trialing" | "active";

/**
 * An organisation's trial, as an admin sees it. Admin-only at the API, so a
 * manager or member never receives this at all.
 */
export type TrialStatus = {
  status: SubscriptionStatus;
  /** ISO timestamps. */
  trialStartedAt: string;
  trialEndsAt: string;
  /** Rounded up, so a running trial always has at least 1. */
  daysLeft: number;
  /** Nothing is blocked by this yet — paid plans are a later ticket. */
  isExpired: boolean;
  /** Trial over, access not: everything works, the banner names the date. */
  isInGrace: boolean;
  /** ISO timestamp: when access stops, once enforcement exists. Measured
   * from the paid period's end once they have paid, the trial's before. */
  accessEndsAt: string;
  /** The end of the period paid for; null while on trial. */
  currentPeriodEnd: string | null;
  /** The paid period has run out but access has not — the trial's grace,
   * applied to a paid ending. */
  isInPaidGrace: boolean;
  /**
   * Whether a payment has ever succeeded. **The one flag to switch on** —
   * every trial-shaped thing in the UI hides on this rather than each
   * surface re-deciding from `trialEndsAt` and disagreeing.
   */
  isPaid: boolean;
  /** When the trial actually stopped: the first payment. History only. */
  trialEndedAt: string | null;
  /** `monthly` or `annual`, once chosen. Null while on trial. */
  billingPeriod: string | null;
  /** Stripe's word for how collection is going: active, past_due, canceled. */
  stripeStatus: string | null;
};

/** `trial` is null for an organisation created before trials existed — it
 * has never been on one, which is a normal state rather than an error. */
/** What the billing endpoint answers: the trial, if any, and whether this
 * organisation is one that never pays (configured server-side). */
export type BillingStatus = {
  trial: TrialStatus | null;
  isFree: boolean;
};

export type GetTrialStatusResult =
  | { ok: true; status: BillingStatus }
  | { ok: false; message: string };

export type BilledSeats = {
  /**
   * What the next invoice covers: the seats bought or the people here,
   * whichever is larger. Buying seats sets a floor, never a cap.
   */
  count: number;
  /** Active members. A pending invitation is not a member yet. */
  memberCount: number;
  /** Null where none were ever bought — every organisation on a trial. */
  purchasedSeats: number | null;
  /** More people than were paid for; what the members banner reads. */
  isOverPurchasedSeats: boolean;
  /**
   * Over the seats, and no admin has yet said they understand what that
   * means for the next invoice.
   */
  needsOverageAcknowledgement: boolean;
};

export type GetBilledSeatsResult =
  | { ok: true; seats: BilledSeats }
  | { ok: false; message: string };

export type SetBilledSeatsResult =
  | { ok: true; seats: BilledSeats; message: string }
  | { ok: false; message: string };
