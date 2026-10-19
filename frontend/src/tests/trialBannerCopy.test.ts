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

  it("keeps showing a banner once the trial has ended", () => {
    expect(trialBannerCopy(trial({ daysLeft: 0, isExpired: true }))).toMatchObject(
      { headline: "Your free trial has ended", tone: "urgent" },
    );
  });
});
