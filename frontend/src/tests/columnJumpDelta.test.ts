import { describe, expect, it } from "vitest";
import { columnJumpDelta } from "@/lib/columnJumpDelta";

const columns = [
  { left: 700, width: 300 },
  { left: 0, width: 300 },
  { left: 350, width: 300 },
];

describe("columnJumpDelta", () => {
  it("moves a card to be centred in the next column to the right", () => {
    // Card (width 200) sits at 50..250 in the first column; the next
    // column's centred slot starts at 350 + (300 - 200) / 2 = 400.
    expect(columnJumpDelta({ left: 50, width: 200 }, columns, 1)).toBe(350);
  });

  it("moves left from the middle column", () => {
    expect(columnJumpDelta({ left: 400, width: 200 }, columns, -1)).toBe(-350);
  });

  it("returns null past the first or last column", () => {
    expect(columnJumpDelta({ left: 50, width: 200 }, columns, -1)).toBeNull();
    expect(columnJumpDelta({ left: 750, width: 200 }, columns, 1)).toBeNull();
  });

  it("uses the nearest column when the card sits in a gap", () => {
    // Centre 335 is in the gap between columns (0..300 and 350..650); the
    // nearest is the middle one (centre 500 is 165 away vs 185), so
    // "right" goes to the last column: 700 + (300 - 50) / 2 - 310 = 515.
    expect(columnJumpDelta({ left: 310, width: 50 }, columns, 1)).toBe(515);
  });

  it("returns null with no columns", () => {
    expect(columnJumpDelta({ left: 0, width: 100 }, [], 1)).toBeNull();
  });
});
