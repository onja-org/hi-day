import { describe, expect, it } from "vitest";
import { buildMemberScreenshotsHref } from "@/lib/buildMemberScreenshotsHref";

describe("buildMemberScreenshotsHref", () => {
  it("links to a teammate's screenshots by their membership", () => {
    expect(buildMemberScreenshotsHref("12", "member-1", "me")).toBe(
      "/organisations/12/activities/screenshots?membershipId=member-1",
    );
  });

  it("links to the viewer's own gallery without a membership filter", () => {
    expect(buildMemberScreenshotsHref("12", "me", "me")).toBe(
      "/organisations/12/activities/screenshots",
    );
  });

  it("filters by membership when the viewer's own is not known yet", () => {
    expect(buildMemberScreenshotsHref("12", "member-1", undefined)).toBe(
      "/organisations/12/activities/screenshots?membershipId=member-1",
    );
  });
});
