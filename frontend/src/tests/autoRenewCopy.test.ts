import { describe, expect, it } from "vitest";
import { autoRenewCopy } from "@/lib/autoRenewCopy";

const CARD = { brand: "Visa", last4: "4242" };

describe("autoRenewCopy", () => {
  it("names the date for an annual renewal", () => {
    expect(
      autoRenewCopy({
        plan: "annual",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2027-08-29T09:00:00.000Z",
        card: CARD,
      }),
    ).toEqual({
      line: "Renews automatically every year on Aug 29, charged to Visa •••• 4242.",
    });
  });

  // A monthly renewal happens twelve times, so a single date would be wrong
  // eleven of them.
  it("names the day of the month for a monthly renewal", () => {
    expect(
      autoRenewCopy({
        plan: "monthly",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2026-11-29T09:00:00.000Z",
        card: CARD,
      }).line,
    ).toBe(
      "Renews automatically every month on the 29th, charged to Visa •••• 4242.",
    );
  });

  it.each([
    ["2026-11-01T09:00:00.000Z", "1st"],
    ["2026-11-02T09:00:00.000Z", "2nd"],
    ["2026-11-03T09:00:00.000Z", "3rd"],
    ["2026-11-04T09:00:00.000Z", "4th"],
    ["2026-11-11T09:00:00.000Z", "11th"],
    ["2026-11-12T09:00:00.000Z", "12th"],
    ["2026-11-13T09:00:00.000Z", "13th"],
    ["2026-11-21T09:00:00.000Z", "21st"],
    ["2026-11-22T09:00:00.000Z", "22nd"],
    ["2026-11-23T09:00:00.000Z", "23rd"],
  ])("writes %s as the %s", (currentPeriodEnd, ordinal) => {
    expect(
      autoRenewCopy({
        plan: "monthly",
        cancelAtPeriodEnd: false,
        currentPeriodEnd,
        card: CARD,
      }).line,
    ).toContain(`on the ${ordinal},`);
  });

  // Auto-renew off is the only state with nothing to promise.
  it("says when access ends, and offers to put it back", () => {
    expect(
      autoRenewCopy({
        plan: "annual",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: "2027-08-29T09:00:00.000Z",
        card: CARD,
      }),
    ).toEqual({
      line: "Ends on Sun, Aug 29, 2027. You keep access until then.",
    });
  });

  it("promises no card it does not have", () => {
    expect(
      autoRenewCopy({
        plan: "annual",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2027-08-29T09:00:00.000Z",
        card: null,
      }).line,
    ).toBe("Renews automatically every year on Aug 29.");
  });

  it("names no date it does not have", () => {
    expect(
      autoRenewCopy({
        plan: "monthly",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        card: CARD,
      }).line,
    ).toBe("Renews automatically, charged to Visa •••• 4242.");
  });
});
