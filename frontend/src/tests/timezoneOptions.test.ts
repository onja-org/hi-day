import { describe, expect, it } from "vitest";
import { timezoneOptions } from "@/lib/timezoneOptions";

describe("timezoneOptions", () => {
  it("offers UTC, which the runtime's own zone list leaves out", () => {
    const zones = timezoneOptions().flatMap((group) => group.zones);

    expect(zones.some((zone) => zone.value === "UTC")).toBe(true);
  });

  it("includes a stored zone the runtime doesn't list, without duplicating one it does", () => {
    const groups = timezoneOptions("Mars/Olympus_Mons");
    const zones = groups.flatMap((group) => group.zones);

    expect(zones.filter((zone) => zone.value === "Mars/Olympus_Mons")).toHaveLength(1);
    expect(
      timezoneOptions("Africa/Nairobi")
        .flatMap((group) => group.zones)
        .filter((zone) => zone.value === "Africa/Nairobi"),
    ).toHaveLength(1);
  });
});
