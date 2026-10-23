import { formatShortDate } from "./formatShortDate";
import type { TrialStatus } from "@/types/billing";

export type TrialBannerTone = "calm" | "urgent";

export type TrialBannerCopy = {
  headline: string;
  detail: string;
  tone: TrialBannerTone;
};

/**
 * Days left at which the banner starts pressing — the same threshold as the
 * first reminder email, so the app and the inbox escalate together rather
 * than on two unrelated scales.
 */
const URGENT_FROM_DAYS_LEFT = 3;

/**
 * What the trial banner says. An expired trial still gets a banner: nothing
 * is blocked yet, and an admin who simply sees the banner vanish has no way
 * to understand or act on their state.
 */
export function trialBannerCopy(trial: TrialStatus): TrialBannerCopy {
  // Named date rather than "soon": the whole point of the grace period is
  // that someone can plan around it, which needs a day they can diary.
  if (trial.isInGrace) {
    return {
      headline: "Your free trial has ended",
      detail: `Your team can keep working until ${formatShortDate(trial.accessEndsAt)}. Add a payment method before then to carry on.`,
      tone: "urgent",
    };
  }

  if (trial.isExpired) {
    return {
      headline: "Your free trial has ended",
      detail: "Add a payment method to keep your team tracking time.",
      tone: "urgent",
    };
  }

  const days = trial.daysLeft;
  return {
    headline: `${days} ${days === 1 ? "day" : "days"} left in your free trial`,
    detail: "Every feature is included, and you haven't been charged.",
    tone: days <= URGENT_FROM_DAYS_LEFT ? "urgent" : "calm",
  };
}
