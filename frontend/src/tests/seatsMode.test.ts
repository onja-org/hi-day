import { describe, expect, it } from "vitest";
import { seatsMode } from "@/lib/seatsMode";

const renewing = { status: "active", isEnded: false, cancelAtPeriodEnd: false };

describe("seatsMode", () => {
  it("is a purchase while there is no subscription (a trial)", () => {
    expect(seatsMode(null)).toBe("purchase");
    expect(seatsMode(undefined)).toBe("purchase");
  });

  it("is a confirmed change for a subscription that renews", () => {
    expect(seatsMode(renewing)).toBe("change");
  });

  // Still a live subscription: a failing renewal can still change seats.
  it("is a confirmed change while a renewal is failing", () => {
    expect(seatsMode({ ...renewing, status: "past_due" })).toBe("change");
  });

  // Adding seats would charge now for a subscription that is ending.
  it("is locked while the subscription is set to end", () => {
    expect(seatsMode({ ...renewing, cancelAtPeriodEnd: true })).toBe("locked");
  });

  // The count becomes the size of the subscription they resume with.
  it("is a purchase again once the subscription has ended", () => {
    expect(seatsMode({ status: "canceled", isEnded: true, cancelAtPeriodEnd: true })).toBe(
      "purchase",
    );
  });

  it("is a purchase while the first payment has not gone through", () => {
    expect(seatsMode({ ...renewing, status: "incomplete" })).toBe("purchase");
  });
});
