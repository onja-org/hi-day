import { describe, expect, it } from "vitest";
import { listDayKeys } from "@/lib/listDayKeys";

describe("listDayKeys", () => {
  it("lists every day inclusive", () => {
    expect(listDayKeys("2026-10-05", "2026-10-07")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
  });

  it("returns one key for a single day", () => {
    expect(listDayKeys("2026-10-05", "2026-10-05")).toEqual(["2026-10-05"]);
  });

  it("crosses month boundaries", () => {
    expect(listDayKeys("2026-09-30", "2026-10-01")).toEqual(["2026-09-30", "2026-10-01"]);
  });

  it("returns nothing when the range is reversed", () => {
    expect(listDayKeys("2026-10-07", "2026-10-05")).toEqual([]);
  });
});
