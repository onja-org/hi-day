/**
 * The trial's arithmetic, kept free of Nest and TypeORM so the rounding and
 * reminder-milestone rules are testable on their own.
 */

/** Exported so the dev driver script measures days the same way this does. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What the pricing page promises: "14-day free trial, no credit card required." */
export const TRIAL_DAYS = 14;

/**
 * Days of continued access after a paid-for period ends, before the
 * organisation loses it. Grace that does not let you keep working would
 * only be a countdown to a second punishment, so the product carries on
 * unchanged and only the banner hardens.
 *
 * Measured from the end of whatever was being paid for — `trialEndsAt` for
 * a trial, `currentPeriodEnd` for a subscription — so both endings read the
 * same to the person they happen to. Deliberately *not* stacked on Stripe's
 * retry window: for a failed renewal Stripe keeps collecting past
 * `currentPeriodEnd`, so these days overlap that rather than extend it, and
 * the real effect is on a cancellation running out or a renewal that never
 * came. See `docs/adr/0030-...`.
 */
export const GRACE_DAYS = 7;

/**
 * When the owner is emailed, in days left, most-distant first. The first two
 * are the same numbers `trialDaysLeft` produces, so an email never disagrees
 * with the banner. `0` is only reachable once the trial has actually run out
 * — days left round up, so a running trial always has at least one — which
 * is what makes it the "your trial has ended" email rather than a fourth
 * warning.
 */
export const TRIAL_REMINDER_DAYS_LEFT = [3, 1, 0] as const;

/**
 * How late a reminder may still go out. Tied to the access grace, and kept
 * tied as that widened: a reminder is worth sending for exactly as long as
 * access survives, so a job down for a few days can still say "access stops
 * on the 18th" while that is actionable, and nothing is sent once access
 * has already gone and the app says so on every page.
 */
const REMINDER_GRACE_MS = GRACE_DAYS * MS_PER_DAY;

export function trialEndFrom(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * MS_PER_DAY);
}

/**
 * Whole days still to run, rounded up, so the final day reads "1 day left"
 * rather than "0" for its last 24 hours. Never negative.
 */
export function trialDaysLeft(trialEndsAt: Date, now: Date): number {
  const remainingMs = trialEndsAt.getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / MS_PER_DAY);
}

export function isTrialExpired(trialEndsAt: Date, now: Date): boolean {
  return now.getTime() >= trialEndsAt.getTime();
}

/**
 * When access would actually stop: the end of what was paid for, plus the
 * grace days. Takes `trialEndsAt` or `currentPeriodEnd` indifferently —
 * the arithmetic is the same and so is the promise.
 */
export function accessEndsAfter(periodEndsAt: Date): Date {
  return new Date(periodEndsAt.getTime() + GRACE_DAYS * MS_PER_DAY);
}

/**
 * The period has run out but access has not: the window where the banner
 * hardens and names a date, and everything else carries on working.
 */
export function isInGrace(periodEndsAt: Date, now: Date): boolean {
  return (
    now.getTime() >= periodEndsAt.getTime() &&
    now.getTime() < accessEndsAfter(periodEndsAt).getTime()
  );
}

/** Kept as the trial-shaped name the trial code and its tests read by. */
export function isInTrialGrace(trialEndsAt: Date, now: Date): boolean {
  return isInGrace(trialEndsAt, now);
}

/**
 * Which reminder to send now, or null for none. Picks the most urgent
 * milestone not yet emailed, so an outage that skips one sends a single
 * accurate email rather than a burst of stale ones.
 */
export function dueTrialReminderDaysLeft(
  trialEndsAt: Date,
  now: Date,
  alreadySentAtDaysLeft: number | null,
): number | null {
  if (now.getTime() > trialEndsAt.getTime() + REMINDER_GRACE_MS) {
    return null;
  }

  const daysLeft = trialDaysLeft(trialEndsAt, now);
  const due = TRIAL_REMINDER_DAYS_LEFT.filter(
    (milestone) =>
      daysLeft <= milestone &&
      (alreadySentAtDaysLeft === null || milestone < alreadySentAtDaysLeft),
  );

  return due.length > 0 ? Math.min(...due) : null;
}
