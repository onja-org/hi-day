import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PaidSubscription } from "@/types/subscription";
import { SubscriptionCard } from "@/components/settings/SubscriptionCard";

function subscription(
  overrides: Partial<PaidSubscription> = {},
): PaidSubscription {
  return {
    plan: "annual",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2027-08-29T09:00:00.000Z",
    seatsPaid: 50,
    subscribedAt: "2026-08-29T09:00:00.000Z",
    card: { brand: "Visa", last4: "4242" },
    paymentFailed: false,
    isEnded: false,
    memberCount: 54,
    nextPaymentMinor: 210_000,
    currency: "usd",
    ...overrides,
  };
}

describe("both cycles", () => {
  it("shows the annual plan, its renewal date and Stripe's amount", () => {
    render(<SubscriptionCard subscription={subscription()} />);

    expect(screen.getByText("Annual plan")).toBeInTheDocument();
    expect(screen.getByText(/Renews automatically every year on Aug 29/)).toBeInTheDocument();
    expect(screen.getByText("$2,100.00")).toBeInTheDocument();
  });

  it("shows the monthly plan with the day of the month", () => {
    render(<SubscriptionCard subscription={subscription({ plan: "monthly" })} />);

    expect(screen.getByText("Monthly plan")).toBeInTheDocument();
    expect(screen.getByText(/every month on the 29th/)).toBeInTheDocument();
  });
});

/**
 * The card states what will happen and offers no way to change it. Both the
 * cycle switch and the auto-renew toggle were removed deliberately: anything
 * that alters a renewal is Stripe's Customer Portal, reached from Billing
 * info. A button here would be a second place for the same state to be
 * changed from, and the first place to go stale.
 */
describe("what it no longer offers", () => {
  it("renders no control for auto-renew or the billing cycle", () => {
    render(<SubscriptionCard subscription={subscription()} />);

    expect(screen.queryByRole("button", { name: /auto-renew/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /switch to/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/prorates the difference/i)).not.toBeInTheDocument();
  });

  // Auto-renew can still be off — switched off in the Portal — so the line
  // has to tell the truth about it rather than promising a renewal.
  it("still says when access stops if auto-renew was turned off elsewhere", () => {
    render(
      <SubscriptionCard subscription={subscription({ cancelAtPeriodEnd: true })} />,
    );

    expect(
      screen.getByText(/Ends on Sun, Aug 29, 2027\. You keep access until then\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Renews automatically/)).not.toBeInTheDocument();
  });
});

describe("a failing renewal", () => {
  it("says the payment failed and that Stripe is retrying", () => {
    render(
      <SubscriptionCard
        subscription={subscription({ status: "past_due", paymentFailed: true })}
      />,
    );

    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.getByText(/keep retrying your card/)).toBeInTheDocument();
  });
});

describe("what it does not invent", () => {
  it("shows no card it does not have, and no amount Stripe did not give", () => {
    render(
      <SubscriptionCard
        subscription={subscription({ card: null, nextPaymentMinor: null })}
      />,
    );

    expect(screen.getByText("None on file")).toBeInTheDocument();
    expect(screen.queryByText(/Next payment ·/)).not.toBeInTheDocument();
  });
});

describe("a subscription that has ended", () => {
  // Stripe's `canceled` is terminal, so promising a renewal would be
  // promising something that cannot happen.
  it("says it ended and promises no renewal", () => {
    render(
      <SubscriptionCard
        subscription={subscription({
          status: "canceled",
          isEnded: true,
          nextPaymentMinor: null,
        })}
      />,
    );

    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText(/This subscription has ended/)).toBeInTheDocument();
    expect(screen.queryByText(/Renews automatically/)).not.toBeInTheDocument();
  });

  // Both, in Stripe's reading — but there is nothing left to retry, so
  // "update your card" would be advice about nothing.
  it("does not also tell them to update their card", () => {
    render(
      <SubscriptionCard
        subscription={subscription({
          status: "canceled",
          isEnded: true,
          paymentFailed: false,
        })}
      />,
    );

    expect(screen.queryByText(/keep retrying your card/)).not.toBeInTheDocument();
  });
});
