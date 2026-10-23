/**
 * The trial's arithmetic, kept free of Nest and TypeORM so the rounding and
 * reminder-milestone rules are testable on their own.
 */

/** Exported so the dev driver script measures days the same way this does. */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What the pricing page promises: "14-day free trial, no credit card required." */
export const TRIAL_DAYS = 14;

/**
 * Days of continued access after the trial ends, before the organisation
 * loses it. Grace that does not let you keep working would only be a
 * countdown to a second punishment, so the product carries on unchanged and
 * only the banner hardens.
 */
export const TRIAL_GRACE_DAYS = 3;

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
 * How late a reminder may still go out. Tied to the access grace: a job that
 * was down for a day should still manage to say "access stops on the 18th"
 * while that is useful, but nothing is worth sending once access has already
 * gone and the app says so on every page.
 */
const REMINDER_GRACE_MS = TRIAL_GRACE_DAYS * MS_PER_DAY;

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

/** When access would actually stop: the trial's end plus the grace days. */
export function accessEndsAfter(trialEndsAt: Date): Date {
  return new Date(trialEndsAt.getTime() + TRIAL_GRACE_DAYS * MS_PER_DAY);
}

/**
 * The trial has run out but access has not: the window where the banner
 * hardens and names a date, and everything else carries on working.
 */
export function isInTrialGrace(trialEndsAt: Date, now: Date): boolean {
  return (
    isTrialExpired(trialEndsAt, now) &&
    now.getTime() < accessEndsAfter(trialEndsAt).getTime()
  );
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
