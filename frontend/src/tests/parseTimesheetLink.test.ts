import { describe, expect, it } from "vitest";
import { parseTimesheetLink } from "@/lib/parseTimesheetLink";

describe("parseTimesheetLink", () => {
  it("reads a member and a day", () => {
    expect(parseTimesheetLink(new URLSearchParams("member=abc&date=2026-11-10"))).toEqual({
      membershipId: "abc",
      date: "2026-11-10",
    });
  });

  it("means your own timesheet and the default range when empty", () => {
    expect(parseTimesheetLink(new URLSearchParams())).toEqual({ membershipId: "", date: null });
  });

  it("ignores a malformed date", () => {
    expect(parseTimesheetLink(new URLSearchParams("date=10-11-2026")).date).toBeNull();
  });
});
