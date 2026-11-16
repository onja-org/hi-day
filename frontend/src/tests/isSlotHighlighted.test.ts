import { describe, expect, it } from "vitest";
import { isSlotHighlighted } from "@/lib/isSlotHighlighted";
import type { ScreenshotSlot } from "@/types/screenshot";

const slot = (start: string, end: string) => ({ start, end }) as ScreenshotSlot;
const highlight = { from: "2026-11-10T14:00:00.000Z", to: "2026-11-10T16:00:00.000Z" };

describe("isSlotHighlighted", () => {
  it("marks slots inside the stretch", () => {
    expect(isSlotHighlighted(slot("2026-11-10T14:00:00.000Z", "2026-11-10T14:10:00.000Z"), highlight)).toBe(true);
    expect(isSlotHighlighted(slot("2026-11-10T15:50:00.000Z", "2026-11-10T16:00:00.000Z"), highlight)).toBe(true);
  });

  it("leaves slots that only touch an end", () => {
    expect(isSlotHighlighted(slot("2026-11-10T13:50:00.000Z", "2026-11-10T14:00:00.000Z"), highlight)).toBe(false);
    expect(isSlotHighlighted(slot("2026-11-10T16:00:00.000Z", "2026-11-10T16:10:00.000Z"), highlight)).toBe(false);
  });

  it("marks nothing without a highlight", () => {
    expect(isSlotHighlighted(slot("2026-11-10T14:00:00.000Z", "2026-11-10T14:10:00.000Z"), null)).toBe(false);
  });
});
