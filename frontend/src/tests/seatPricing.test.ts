import { describe, expect, it } from "vitest";
import {
  formatMoney,
  seatPricing,
  trialProgressFraction,
} from "@/lib/seatPricing";

describe("seatPricing", () => {
  // The worked example from the design: six seats at $3.50 a month annually,
  // or $4.00 a month monthly.
  it("prices six seats both ways", () => {
    const pricing = seatPricing(6);

    expect(pricing.annual.totalMinor).toBe(25_200); // $252.00 / year
    expect(pricing.annual.perMonthMinor).toBe(2_100); // $21.00 / month
    expect(pricing.annual.perSeatPerMonthMinor).toBe(350); // $3.50
    expect(pricing.monthly.totalMinor).toBe(2_400); // $24.00 / month
    expect(pricing.monthly.over12MonthsMinor).toBe(28_800); // $288.00
    expect(pricing.monthly.perSeatMinor).toBe(400); // $4.00
    expect(pricing.savingPerYearMinor).toBe(3_600); // $36.00
  });

  // The breakdown must add up to the total beside it, or the page is arguing
  // with itself.
  it("keeps the annual total equal to its own breakdown", () => {
    for (const seats of [1, 3, 7, 50, 999]) {
      const pricing = seatPricing(seats);
      expect(pricing.annual.perSeatPerMonthMinor * 12 * seats).toBe(
        pricing.annual.totalMinor,
      );
      expect(
        pricing.monthly.over12MonthsMinor - pricing.annual.totalMinor,
      ).toBe(pricing.savingPerYearMinor);
    }
  });

  it("charges nothing for nobody", () => {
    expect(seatPricing(0).annual.totalMinor).toBe(0);
    expect(seatPricing(0).savingPerYearMinor).toBe(0);
  });

  it("always keeps annual cheaper than paying monthly", () => {
    for (const seats of [1, 2, 25, 1_000]) {
      expect(seatPricing(seats).savingPerYearMinor).toBeGreaterThan(0);
    }
  });
});

describe("formatMoney", () => {
  // Two decimals even on a round figure: these sit in a column of sums.
  it("keeps the cents so the column lines up", () => {
    expect(formatMoney(25_200, "en-US")).toBe("$252.00");
    expect(formatMoney(2_100, "en-US")).toBe("$21.00");
    expect(formatMoney(0, "en-US")).toBe("$0.00");
  });
});

describe("trialProgressFraction", () => {
  const START = "2026-10-20T09:00:00.000Z";
  const END = "2026-11-03T09:00:00.000Z";

  it("is empty on the first day and full on the last", () => {
    expect(trialProgressFraction(START, END, new Date(START))).toBe(0);
    expect(trialProgressFraction(START, END, new Date(END))).toBe(1);
  });

  it("is half way at the half way point", () => {
    expect(
      trialProgressFraction(START, END, new Date("2026-10-27T09:00:00.000Z")),
    ).toBeCloseTo(0.5);
  });

  // An expired trial reads as a full bar, never an overflowing one.
  it("clamps at both ends", () => {
    expect(
      trialProgressFraction(START, END, new Date("2026-12-25T09:00:00.000Z")),
    ).toBe(1);
    expect(
      trialProgressFraction(START, END, new Date("2026-01-01T09:00:00.000Z")),
    ).toBe(0);
  });

  it("reads a nonsense range as finished rather than dividing by zero", () => {
    expect(trialProgressFraction(END, START)).toBe(1);
    expect(trialProgressFraction(START, START)).toBe(1);
  });
});
