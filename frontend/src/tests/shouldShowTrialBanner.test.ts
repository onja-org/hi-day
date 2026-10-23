import { describe, expect, it } from "vitest";
import { shouldShowTrialBanner } from "@/lib/shouldShowTrialBanner";
import type { TrialStatus } from "@/types/billing";

function trial(overrides: Partial<TrialStatus> = {}): TrialStatus {
  return {
    status: "trialing",
    trialStartedAt: "2026-01-01T09:00:00.000Z",
    trialEndsAt: "2026-01-15T09:00:00.000Z",
    daysLeft: 14,
    isExpired: false,
    isInGrace: false,
    accessEndsAt: "2026-01-18T09:00:00.000Z",
    ...overrides,
  };
}

describe("shouldShowTrialBanner", () => {
  it("stays out of the way for most of the trial", () => {
    expect(shouldShowTrialBanner(trial({ daysLeft: 14 }))).toBe(false);
    expect(shouldShowTrialBanner(trial({ daysLeft: 4 }))).toBe(false);
  });

  it("appears three days out, where the first reminder email also lands", () => {
    expect(shouldShowTrialBanner(trial({ daysLeft: 3 }))).toBe(true);
    expect(shouldShowTrialBanner(trial({ daysLeft: 1 }))).toBe(true);
  });

  it("stays up once the trial has ended", () => {
    expect(
      shouldShowTrialBanner(
        trial({ daysLeft: 0, isExpired: true, isInGrace: true }),
      ),
    ).toBe(true);
  });

  it("stays up after the grace period too", () => {
    expect(
      shouldShowTrialBanner(
        trial({ daysLeft: 0, isExpired: true, isInGrace: false }),
      ),
    ).toBe(true);
  });
});
