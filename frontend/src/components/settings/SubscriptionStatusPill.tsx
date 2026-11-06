import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import type { PaidSubscription } from "@/types/subscription";

type SubscriptionStatusPillProps = {
  subscription: Pick<PaidSubscription, "paymentFailed" | "isEnded">;
};

/** Active, Payment failed or Ended — the first thing the subscription card says. */
export function SubscriptionStatusPill({ subscription }: SubscriptionStatusPillProps) {
  const trouble = subscription.paymentFailed || subscription.isEnded;
  const Icon = trouble ? WarningCircleIcon : CheckCircleIcon;
  return (
    <p
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold",
        trouble && "bg-sun text-ink",
        !trouble && "bg-success/15 text-success",
      )}
    >
      <Icon size={14} weight="bold" aria-hidden="true" />
      {subscription.isEnded
        ? "Ended"
        : subscription.paymentFailed
          ? "Payment failed"
          : "Active"}
    </p>
  );
}
