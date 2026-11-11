import { describe, expect, it } from "vitest";
import { changedDatetimeValue } from "@/lib/changedDatetimeValue";
import { toDatetimeLocalValue } from "@/lib/toDatetimeLocalValue";

// A recorded time with seconds, as a fresh timer's start always has.
const RECORDED = "2026-11-11T07:53:20.637Z";
const SAME_MINUTE = toDatetimeLocalValue(RECORDED);

describe("changedDatetimeValue", () => {
  it("treats the recorded minute as unchanged, so its seconds survive", () => {
    expect(changedDatetimeValue(SAME_MINUTE, RECORDED)).toBeUndefined();
  });

  it("returns a different minute", () => {
    const earlier = toDatetimeLocalValue("2026-11-11T07:50:00.000Z");

    expect(changedDatetimeValue(earlier, RECORDED)).toBe(earlier);
  });

  it("returns any value when there was none recorded", () => {
    expect(changedDatetimeValue(SAME_MINUTE, null)).toBe(SAME_MINUTE);
  });

  it("returns nothing for an empty field", () => {
    expect(changedDatetimeValue("", RECORDED)).toBeUndefined();
  });
});
