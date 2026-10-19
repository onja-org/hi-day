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
