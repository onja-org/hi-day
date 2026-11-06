import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillingStatus, TrialStatus } from "@/types/billing";

const useTrialStatus = vi.fn();
vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: (organisationId: number | string) =>
    useTrialStatus(organisationId) as unknown,
  trialStatusQueryKey: (organisationId: number | string) => [
    "billing",
    "trial",
    String(organisationId),
  ],
}));
const { TrialBanner } = await import("@/components/TrialBanner");

function trial(overrides: Partial<TrialStatus> = {}): TrialStatus {
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

function renderWith(data: BillingStatus | undefined) {
  useTrialStatus.mockReturnValue({ data });
  return render(<TrialBanner organisationId={100000} />);
}

describe("TrialBanner", () => {
  it("counts down for an organisation still on its trial", () => {
    renderWith({ trial: trial(), isFree: false });

    expect(screen.getByRole("complementary")).toHaveTextContent(
      /6 days left in your free trial/,
    );
  });

  // The Billing page shows the plan, cycle and seats before the card form.
  it("sends Add payment to the Billing page", () => {
    renderWith({ trial: trial(), isFree: false });

    expect(screen.getByRole("link", { name: "Add payment" })).toHaveAttribute(
      "href",
      "/organisations/100000/settings/billing/subscription",
    );
  });

  /**
   * The whole point of the paid switch: the trial ended the day they paid,
   * so a countdown would be counting down something that is over. Keyed on
   * `isPaid` rather than on the dates, which still say the trial runs until
   * November.
   */
  it("says nothing once the organisation has paid", () => {
    renderWith({
      trial: trial({
        isPaid: true,
        status: "active",
        trialEndedAt: "2026-10-26T09:00:00.000Z",
        billingPeriod: "annual",
        stripeStatus: "active",
      }),
      isFree: false,
    });

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("says nothing for an organisation that never pays", () => {
    renderWith({ trial: trial(), isFree: true });

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("says nothing for anyone the endpoint refuses", () => {
    renderWith(undefined);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
