import { describe, expect, it } from "vitest";
import { trialBannerCopy } from "@/lib/trialBannerCopy";
import type { TrialStatus } from "@/types/billing";

function trial(overrides: Partial<TrialStatus> = {}): TrialStatus {
  return {
    status: "trialing",
    trialStartedAt: "2026-01-01T09:00:00.000Z",
    trialEndsAt: "2026-01-15T09:00:00.000Z",
    daysLeft: 14,
    isExpired: false,
    isInGrace: false,
    accessEndsAt: "2026-01-22T09:00:00.000Z",
    currentPeriodEnd: null,
    isInPaidGrace: false,
    isPaid: false,
    trialEndedAt: null,
    billingPeriod: null,
    stripeStatus: null,
    ...overrides,
  };
}

describe("trialBannerCopy", () => {
  it("stays calm early in the trial", () => {
    expect(trialBannerCopy(trial({ daysLeft: 14 }))).toMatchObject({
      headline: "14 days left in your free trial",
      tone: "calm",
    });
  });

  it("presses from three days out, matching the first reminder email", () => {
    expect(trialBannerCopy(trial({ daysLeft: 4 })).tone).toBe("calm");
    expect(trialBannerCopy(trial({ daysLeft: 3 })).tone).toBe("urgent");
  });

  it("says day, not days, on the final day", () => {
    expect(trialBannerCopy(trial({ daysLeft: 1 })).headline).toBe(
      "1 day left in your free trial",
    );
  });

  it("names the date access stops while in the grace period", () => {
    const copy = trialBannerCopy(
      trial({ daysLeft: 0, isExpired: true, isInGrace: true }),
    );

    expect(copy.headline).toBe("Your free trial has ended");
    expect(copy.detail).toContain("Jan 22, 2026");
    expect(copy.tone).toBe("urgent");
  });

  it("keeps showing a banner once the trial has ended", () => {
    expect(trialBannerCopy(trial({ daysLeft: 0, isExpired: true }))).toMatchObject(
      { headline: "Your free trial has ended", tone: "urgent" },
    );
  });
});

describe("trialBannerCopy for a paid plan that has ended", () => {
  // The trial dates stay on the row as history, so this has to win: a
  // paying customer told "your trial has ended" would rightly be baffled.
  it("names the plan, not the trial, and the date access stops", () => {
    expect(
      trialBannerCopy(
        trial({
          isInPaidGrace: true,
          isExpired: true,
          currentPeriodEnd: "2026-06-01T09:00:00.000Z",
          accessEndsAt: "2026-06-08T09:00:00.000Z",
        }),
      ),
    ).toMatchObject({ headline: "Your plan has ended", tone: "urgent" });
  });
});
