/**
 * The trial's arithmetic, kept free of Nest and TypeORM so the rounding and
 * reminder-milestone rules are testable on their own.
 */

/** Exported so the dev driver script measures days the same way this does. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What the pricing page promises: "14-day free trial, no credit card required." */
export const TRIAL_DAYS = 14;

/**
 * When the owner is emailed, in days left, most-distant first. These are the
 * same numbers `trialDaysLeft` produces, so an email never disagrees with the
 * banner — which is why the last one is `1` and not `0`: days left round up,
 * so a running trial always has at least one left.
 */
export const TRIAL_REMINDER_DAYS_LEFT = [3, 1] as const;

/**
 * How late a reminder may still go out. Past this, the trial is simply over
 * and the banner says so, rather than an email claiming it ends today.
 */
const REMINDER_GRACE_MS = MS_PER_DAY;

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
