import { describe, expect, it } from "vitest";
import { buildUnusualInstanceLinks } from "@/lib/buildUnusualInstanceLinks";

const now = new Date("2026-11-12T08:00:00Z");

describe("buildUnusualInstanceLinks", () => {
  it("links to the member's screenshots, on the stretch, and timesheet for that day", () => {
    expect(
      buildUnusualInstanceLinks({
        organisationId: "1",
        membershipId: "abc",
        start: "2026-11-10T14:00:00.000Z",
        end: "2026-11-10T16:00:00.000Z",
        date: "2026-11-10",
        timezone: "Africa/Nairobi",
        now,
      }),
    ).toEqual({
      screenshots:
        "/organisations/1/activities/screenshots?membershipId=abc&day=-2&highlightFrom=2026-11-10T14%3A00%3A00.000Z&highlightTo=2026-11-10T16%3A00%3A00.000Z",
      timesheet: "/organisations/1/time_entries?member=abc&date=2026-11-10",
    });
  });

  it("leaves the member out for your own", () => {
    const links = buildUnusualInstanceLinks({
      organisationId: "1",
      start: "2026-11-12T03:00:00.000Z",
      end: "2026-11-12T04:00:00.000Z",
      date: "2026-11-12",
      timezone: "Africa/Nairobi",
      now,
    });

    expect(links.screenshots).toBe(
      "/organisations/1/activities/screenshots?highlightFrom=2026-11-12T03%3A00%3A00.000Z&highlightTo=2026-11-12T04%3A00%3A00.000Z",
    );
    expect(links.timesheet).toBe("/organisations/1/time_entries?date=2026-11-12");
  });

  it("finds screenshots on the organisation's day, not the UTC day it started", () => {
    // 01:00 on Nov 10 in Nairobi is still Nov 9 in UTC; Screenshots reads
    // the organisation's calendar, so it is two days back, not three.
    const links = buildUnusualInstanceLinks({
      organisationId: "1",
      membershipId: "abc",
      start: "2026-11-09T22:00:00.000Z",
      end: "2026-11-09T23:00:00.000Z",
      date: "2026-11-10",
      timezone: "Africa/Nairobi",
      now,
    });

    expect(links.screenshots).toContain("day=-2");
    expect(links.timesheet).toContain("date=2026-11-10");
  });
});
