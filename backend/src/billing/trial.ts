/**
 * The trial's arithmetic, kept free of Nest and TypeORM so the awkward parts
 * — rounding days, deciding which reminder is due — are testable on their
 * own. See CONTEXT.md's Trial entry for the vocabulary.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What the pricing page promises: "14-day free trial, no credit card required." */
export const TRIAL_DAYS = 14;

/**
 * When the owner is emailed, in days left, most-distant first: three days
 * out, then the final day. Adding `7` here is the whole change needed to add
 * a week-out reminder.
 *
 * These are the same numbers `trialDaysLeft` produces, so an email never
 * disagrees with the banner. That is why the last one is `1` and not `0`:
 * days left round *up*, so a trial still running always has at least one day
 * left, and `0` would only ever be reached once the trial had already ended.
 */
export const TRIAL_REMINDER_DAYS_LEFT = [3, 1] as const;

/**
 * How late a reminder may still go out. A job that has been down for a week
 * should not greet an owner with "today is the last day of your trial" about
 * a trial that ended days ago; past this, the trial is simply over and the
 * banner says so.
 */
const REMINDER_GRACE_MS = MS_PER_DAY;

export function trialEndFrom(startedAt: Date): Date {
  return new Date(startedAt.getTime() + TRIAL_DAYS * MS_PER_DAY);
}

/**
 * Whole days still to run, rounded up, so the final day reads "1 day left"
 * rather than "0 days left" for its whole last 24 hours. Never negative: an
 * expired trial has no days left, it has `isTrialExpired`.
 */
export function trialDaysLeft(trialEndsAt: Date, now: Date): number {
  const remainingMs = trialEndsAt.getTime() - now.getTime();
  return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / MS_PER_DAY);
}

export function isTrialExpired(trialEndsAt: Date, now: Date): boolean {
  return now.getTime() >= trialEndsAt.getTime();
}

/**
 * Which reminder to send right now, or null for none. Picks the *most
 * urgent* milestone the trial has reached and not yet been emailed about, so
 * an outage that skips a milestone sends one accurate email rather than a
 * burst of increasingly stale ones.
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
