import { describe, expect, it } from "vitest";
import { canStartSubscription } from "@/lib/canStartSubscription";
import type { TrialStatus } from "@/types/billing";

function trial(overrides: Partial<TrialStatus>): TrialStatus {
  return {
    status: "trialing",
    isPaid: false,
    trialStartedAt: "2026-10-20T09:00:00.000Z",
    trialEndsAt: "2026-11-03T09:00:00.000Z",
    trialEndedAt: null,
    daysLeft: 6,
    isExpired: false,
    isInGrace: false,
    accessEndsAt: "2026-11-10T09:00:00.000Z",
    currentPeriodEnd: null,
    isInPaidGrace: false,
    billingPeriod: null,
    stripeStatus: null,
    ...overrides,
  };
}

describe("canStartSubscription", () => {
  it("offers to pay during a trial that has never reached Stripe", () => {
    expect(canStartSubscription(trial({}))).toBe(true);
  });

  // A declined card or failed 3-D Secure: the retry the bug made impossible.
  it("offers to pay again after a first payment that did not go through", () => {
    expect(canStartSubscription(trial({ stripeStatus: "incomplete" }))).toBe(true);
    expect(canStartSubscription(trial({ stripeStatus: "incomplete_expired" }))).toBe(true);
  });

  // `isPaid` stays true for good, which used to hide the way back.
  it("offers to pay again to a customer who cancelled", () => {
    expect(
      canStartSubscription(trial({ isPaid: true, status: "active", stripeStatus: "canceled" })),
    ).toBe(true);
  });

  it("offers to retry a comeback whose first payment was declined", () => {
    expect(
      canStartSubscription(trial({ isPaid: true, status: "active", stripeStatus: "incomplete" })),
    ).toBe(true);
  });

  // Paying again beside any of these would bill twice; a failed renewal is
  // fixed by updating the card.
  it.each(["active", "past_due", "unpaid", "paused", "something_new"])(
    "does not offer to pay beside a subscription that is %s",
    (stripeStatus) => {
      expect(canStartSubscription(trial({ isPaid: true, status: "active", stripeStatus }))).toBe(
        false,
      );
    },
  );

  it("does not offer to pay when paid but Stripe's status has not arrived", () => {
    expect(canStartSubscription(trial({ isPaid: true, status: "active" }))).toBe(false);
  });

  it("offers to pay before the status has loaded", () => {
    expect(canStartSubscription(undefined)).toBe(true);
  });
});
