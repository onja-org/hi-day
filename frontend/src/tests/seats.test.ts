import { describe, expect, it } from "vitest";
import {
  MAX_PURCHASABLE_SEATS,
  parseSeatInput,
  seatOccupancy,
} from "@/lib/seats";

/**
 * `parseSeatCount` is the backend's, copied in by `gen:shared-rules`, and is
 * covered by its own suite there. What is tested here is only what the
 * browser adds on top.
 */
describe("parseSeatInput", () => {
  it("reads a typed figure", () => {
    expect(parseSeatInput("12")).toBe(12);
    expect(parseSeatInput("  12  ")).toBe(12);
  });

  // An empty box is somebody mid-edit, not a request to buy nothing — which
  // is why it reads as invalid rather than as zero.
  it("treats an empty box as nothing to buy yet", () => {
    expect(parseSeatInput("")).toBeNull();
    expect(parseSeatInput("   ")).toBeNull();
  });

  // The field is text, not type=number, so this is what stops "1e3", "-4"
  // and a pasted phone number from reaching the bill.
  it("refuses anything that is not plain digits", () => {
    expect(parseSeatInput("1e3")).toBeNull();
    expect(parseSeatInput("-4")).toBeNull();
    expect(parseSeatInput("4.5")).toBeNull();
    expect(parseSeatInput("twelve")).toBeNull();
    expect(parseSeatInput("+1 555 0100")).toBeNull();
  });

  it("refuses a figure past the ceiling rather than clamping it", () => {
    expect(parseSeatInput(String(MAX_PURCHASABLE_SEATS))).toBe(
      MAX_PURCHASABLE_SEATS,
    );
    expect(parseSeatInput(String(MAX_PURCHASABLE_SEATS + 1))).toBeNull();
  });
});

describe("seatOccupancy", () => {
  it("fills one seat per member while the team fits", () => {
    expect(seatOccupancy(4, 10)).toMatchObject({
      total: 10,
      filled: 4,
      overBy: 0,
      fraction: 0.4,
    });
  });

  // The state that most needs pointing out must not render as a tidy full
  // row, which is what capping `filled` and splitting out `overBy` prevents.
  it("keeps the overflow separate rather than growing the row", () => {
    expect(seatOccupancy(14, 10)).toMatchObject({
      total: 10,
      filled: 10,
      overBy: 4,
      fraction: 1,
    });
  });

  it("treats the team as the total where no seats were bought", () => {
    expect(seatOccupancy(7, null)).toMatchObject({
      total: 7,
      filled: 7,
      overBy: 0,
    });
  });

  // One bar at any scale now, so a large purchase is just a smaller
  // fraction rather than a different drawing.
  it("scales to a purchase of any size", () => {
    expect(seatOccupancy(400, 500).fraction).toBe(0.8);
    expect(seatOccupancy(1, 1000).fraction).toBeCloseTo(0.001);
  });

  // An organisation with nobody in it still has a denominator.
  it("never divides by zero", () => {
    expect(seatOccupancy(0, null)).toMatchObject({ total: 1, fraction: 0 });
    expect(seatOccupancy(0, 0)).toMatchObject({ total: 1, fraction: 0 });
  });
});
