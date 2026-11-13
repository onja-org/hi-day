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
      now,
    });

    expect(links.screenshots).toBe(
      "/organisations/1/activities/screenshots?highlightFrom=2026-11-12T03%3A00%3A00.000Z&highlightTo=2026-11-12T04%3A00%3A00.000Z",
    );
    expect(links.timesheet).toBe("/organisations/1/time_entries?date=2026-11-12");
  });

  it("finds screenshots by the UTC day the instance started, not the org's day", () => {
    // 01:00 on Nov 10 in UTC+3 is still Nov 9 in UTC, where Screenshots looks.
    const links = buildUnusualInstanceLinks({
      organisationId: "1",
      membershipId: "abc",
      start: "2026-11-09T22:00:00.000Z",
      end: "2026-11-09T23:00:00.000Z",
      date: "2026-11-10",
      now,
    });

    expect(links.screenshots).toContain("day=-3");
    expect(links.timesheet).toContain("date=2026-11-10");
  });
});
