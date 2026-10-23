import type { TrialStatus } from "@/types/billing";

/**
 * Days left at which the banner starts appearing on every page — the same
 * threshold as the first reminder email, so the app and the inbox start
 * pressing together.
 */
export const BANNER_FROM_DAYS_LEFT = 3;

/**
 * Whether the trial banner belongs on an ordinary page.
 *
 * Only near the end. A countdown on every page from day one is wallpaper by
 * day three — it trains people to look past the strip that will later carry
 * the thing they actually need to act on. The Billing section still states
 * the trial at any point, for anyone who goes looking.
 *
 * Once the trial has run out it stays up whatever the number: that is the
 * point at which it has something to say.
 */
export function shouldShowTrialBanner(trial: TrialStatus): boolean {
  return trial.isExpired || trial.daysLeft <= BANNER_FROM_DAYS_LEFT;
}
