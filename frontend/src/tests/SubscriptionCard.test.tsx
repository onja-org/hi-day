import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaidSubscription } from "@/types/subscription";

const setAutoRenew = vi.fn();
const switchCycle = vi.fn();
const invalidateQueries = vi.fn();

vi.mock("@/lib/subscriptionApi", () => ({
  setAutoRenew: (...args: unknown[]) => setAutoRenew(...args) as unknown,
  switchCycle: (...args: unknown[]) => switchCycle(...args) as unknown,
}));
vi.mock("@/hooks/useSubscription", () => ({
  subscriptionQueryKey: () => ["billing", "subscription"],
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  // A mutation thin enough to drive synchronously from a click.
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (vars: never) => Promise<unknown>;
    onSuccess: (result: unknown, vars: never) => void;
  }) => ({
    isPending: false,
    mutate: (vars: never) => {
      void mutationFn(vars).then((result) => onSuccess(result, vars));
    },
  }),
}));

const { SubscriptionCard } = await import(
  "@/components/settings/SubscriptionCard"
);

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

beforeEach(() => {
  setAutoRenew.mockReset();
  switchCycle.mockReset();
  setAutoRenew.mockResolvedValue({ ok: true, data: null });
  switchCycle.mockResolvedValue({ ok: true, data: null });
});

describe("both cycles", () => {
  it("shows the annual plan, its renewal date and Stripe's amount", () => {
    render(
      <SubscriptionCard organisationId={100000} subscription={subscription()} />,
    );

    expect(screen.getByText("Annual plan")).toBeInTheDocument();
    expect(
      screen.getByText(/Renews automatically every year on Aug 29, charged to Visa •••• 4242\./),
    ).toBeInTheDocument();
    expect(screen.getByText("$2,100.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to monthly" })).toBeInTheDocument();
  });

  it("shows the monthly plan with the day of the month", () => {
    render(
      <SubscriptionCard
        organisationId={100000}
        subscription={subscription({
          plan: "monthly",
          currentPeriodEnd: "2026-11-29T09:00:00.000Z",
          nextPaymentMinor: 20_000,
        })}
      />,
    );

    expect(screen.getByText("Monthly plan")).toBeInTheDocument();
    expect(
      screen.getByText(/Renews automatically every month on the 29th/),
    ).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to annual" })).toBeInTheDocument();
  });
});

describe("auto-renew", () => {
  it("turns off through Stripe's cancel_at_period_end", async () => {
    render(
      <SubscriptionCard organisationId={100000} subscription={subscription()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Turn off auto-renew" }));

    await waitFor(() => expect(setAutoRenew).toHaveBeenCalledWith(100000, false));
  });

  // Off shows when access stops and offers to put it back, rather than
  // repeating a renewal promise it is no longer making.
  it("shows the end date and offers to turn it back on", async () => {
    render(
      <SubscriptionCard
        organisationId={100000}
        subscription={subscription({ cancelAtPeriodEnd: true })}
      />,
    );

    expect(
      screen.getByText(/Ends on Sun, Aug 29, 2027\. You keep access until then\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Renews automatically/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Turn on auto-renew" }));
    await waitFor(() => expect(setAutoRenew).toHaveBeenCalledWith(100000, true));
  });
});

describe("a failing renewal", () => {
  it("says the payment failed and that Stripe is retrying", () => {
    render(
      <SubscriptionCard
        organisationId={100000}
        subscription={subscription({ status: "past_due", paymentFailed: true })}
      />,
    );

    expect(screen.getByText("Payment failed")).toBeInTheDocument();
    expect(screen.getByText(/keep retrying your card/)).toBeInTheDocument();
  });
});

describe("switching cycle", () => {
  // Nothing is sent until it is confirmed: a switch reprices the whole
  // subscription and prorates.
  it("asks before switching, and only then calls Stripe", async () => {
    render(
      <SubscriptionCard organisationId={100000} subscription={subscription()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to monthly" }));
    expect(switchCycle).not.toHaveBeenCalled();
    expect(screen.getByText(/Stripe prorates the difference/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm monthly" }));
    await waitFor(() =>
      expect(switchCycle).toHaveBeenCalledWith(100000, "monthly"),
    );
  });
});

describe("what it does not invent", () => {
  it("shows no card it does not have, and no amount Stripe did not give", () => {
    render(
      <SubscriptionCard
        organisationId={100000}
        subscription={subscription({ card: null, nextPaymentMinor: null })}
      />,
    );

    expect(screen.getByText("None on file")).toBeInTheDocument();
    expect(screen.queryByText(/Next payment ·/)).not.toBeInTheDocument();
  });
});

describe("a subscription that has ended", () => {
  /**
   * Stripe's `canceled` is terminal. Promising a renewal, offering to turn
   * auto-renew back on, or offering a cycle switch would all be offering
   * something that cannot happen.
   */
  it("says it ended and offers nothing it cannot do", () => {
    render(
      <SubscriptionCard
        organisationId={100000}
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
    expect(
      screen.queryByRole("button", { name: /auto-renew/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Switch to/ }),
    ).not.toBeInTheDocument();
  });

  // Both, in Stripe's reading — but there is nothing left to retry, so
  // "update your card" would be advice about nothing.
  it("does not also tell them to update their card", () => {
    render(
      <SubscriptionCard
        organisationId={100000}
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
