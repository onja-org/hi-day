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

export type GetTrialStatusResult =
  | { ok: true; trial: TrialStatus }
  | { ok: false; message: string };
