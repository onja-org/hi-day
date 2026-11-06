import { describe, expect, it } from "vitest";
import { renewalAction } from "@/lib/renewalAction";

const renewing = { status: "active", isEnded: false, cancelAtPeriodEnd: false };
const ended = { status: "canceled", isEnded: true, cancelAtPeriodEnd: true };

describe("renewalAction", () => {
  it("offers to cancel a subscription that renews", () => {
    expect(renewalAction(renewing, true)).toBe("cancel");
  });

  // A failing renewal can still be told not to come back.
  it("offers to cancel while a renewal is failing", () => {
    expect(renewalAction({ ...renewing, status: "past_due" }, true)).toBe("cancel");
  });

  it("offers to resume one cancelled while its paid period still runs", () => {
    expect(renewalAction({ ...renewing, cancelAtPeriodEnd: true }, true)).toBe("resume");
  });

  // The grace days: the period has ended, access has not.
  it("offers to resume an ended one while access remains", () => {
    expect(renewalAction(ended, true)).toBe("renew");
  });

  it("offers nothing once the grace days are over", () => {
    expect(renewalAction(ended, false)).toBeNull();
  });

  it("offers nothing before the first payment has gone through", () => {
    expect(renewalAction({ ...renewing, status: "incomplete" }, true)).toBeNull();
  });
});
