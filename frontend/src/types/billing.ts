/** Mirrors the backend's `SubscriptionStatus`. Only trials exist so far. */
export type SubscriptionStatus = "trialing";

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
