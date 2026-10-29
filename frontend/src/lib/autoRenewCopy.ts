import { formatShortDate } from "./formatShortDate";
import type { PaidSubscription } from "@/types/subscription";

/**
 * What the auto-renew line says. Pure, because it is the one sentence on the
 * page that states a commitment to charge somebody — worth being able to
 * test every branch of without rendering anything.
 */
export type AutoRenewCopy = {
  /** The sentence itself. */
  line: string;
  /** What the action beside it offers. */
  action: "turn-off" | "turn-on";
};

/** "the 29th", for a monthly renewal that lands on the same date each month. */
function ordinalDay(date: Date): string {
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

export function autoRenewCopy(
  subscription: Pick<
    PaidSubscription,
    "plan" | "cancelAtPeriodEnd" | "currentPeriodEnd" | "card"
  >,
): AutoRenewCopy {
  const end = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;

  // Auto-renew off is the only state with nothing to promise: it says when
  // access stops, and offers to put it back.
  if (subscription.cancelAtPeriodEnd) {
    return {
      line: end
        ? `Ends on ${formatShortDate(end)}. You keep access until then.`
        : "Auto-renew is off. You keep access until the period ends.",
      action: "turn-on",
    };
  }

  const card = subscription.card
    ? `, charged to ${subscription.card.brand} •••• ${subscription.card.last4}`
    : "";

  // Annual names the date, monthly names the day of the month — a monthly
  // renewal happens twelve times and a single date would be wrong eleven of
  // them.
  const when = !end
    ? ""
    : subscription.plan === "annual"
      ? ` every year on ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(end)}`
      : ` every month on the ${ordinalDay(end)}`;

  return { line: `Renews automatically${when}${card}.`, action: "turn-off" };
}
