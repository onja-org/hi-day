import { describe, expect, it } from "vitest";
import { buildHourTicks } from "@/lib/buildHourTicks";

describe("buildHourTicks", () => {
  it("rounds the top tick up to the next whole hour", () => {
    expect(buildHourTicks(2 * 3600 + 1)).toEqual([0, 3600, 7200, 10800]);
  });

  it("keeps an exact hour as the top tick", () => {
    expect(buildHourTicks(3600)).toEqual([0, 3600]);
  });

  it("still shows a 0-1h axis when there is no data", () => {
    expect(buildHourTicks(0)).toEqual([0, 3600]);
  });
});
