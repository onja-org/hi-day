import { describe, expect, it } from "vitest";
import { isNavLinkActive } from "@/lib/isNavLinkActive";

const TEAMS = { href: "/organisations/1/teams" };
const ALL_SETTINGS = { href: "/organisations/1/settings", exact: true };
const TRACKING_GROUP = {
  href: "/organisations/1/settings/tracking/activity",
  activePrefix: "/organisations/1/settings/tracking",
};
const MEMBERS_GROUP = {
  href: "/organisations/1/settings/members/work-time-limits",
  activePrefix: "/organisations/1/settings/members",
};

describe("isNavLinkActive", () => {
  it("is active on the link's own page", () => {
    expect(isNavLinkActive("/organisations/1/teams", TEAMS)).toBe(true);
  });

  it("is active on a page nested under the link", () => {
    expect(isNavLinkActive("/organisations/1/teams/abc", TEAMS)).toBe(true);
  });

  it("is not active on a sibling whose path merely shares a prefix", () => {
    expect(isNavLinkActive("/organisations/1/teamsx", TEAMS)).toBe(false);
  });

  it("is not active on an unrelated page", () => {
    expect(isNavLinkActive("/organisations/1/projects", TEAMS)).toBe(false);
  });

  describe("exact", () => {
    it("is active on its own page", () => {
      expect(isNavLinkActive("/organisations/1/settings", ALL_SETTINGS)).toBe(
        true,
      );
    });

    // Without `exact`, "All settings" would stay lit inside every section,
    // because its href is the parent of all of them.
    it("is not active on a page nested under it", () => {
      expect(
        isNavLinkActive(
          "/organisations/1/settings/tracking/timesheets",
          ALL_SETTINGS,
        ),
      ).toBe(false);
    });
  });

  describe("activePrefix", () => {
    it("is active on the section it links to", () => {
      expect(
        isNavLinkActive(
          "/organisations/1/settings/tracking/activity",
          TRACKING_GROUP,
        ),
      ).toBe(true);
    });

    // The point of the whole thing: a group links to its first section but
    // owns all four.
    it("is active on every other section in the group", () => {
      for (const section of ["timesheets", "time", "screenshots"]) {
        expect(
          isNavLinkActive(
            `/organisations/1/settings/tracking/${section}`,
            TRACKING_GROUP,
          ),
        ).toBe(true);
      }
    });

    it("is active on the Members group's own section", () => {
      expect(
        isNavLinkActive(
          "/organisations/1/settings/members/work-time-limits",
          MEMBERS_GROUP,
        ),
      ).toBe(true);
    });

    it("is not active on a different group's section", () => {
      expect(
        isNavLinkActive(
          "/organisations/1/settings/organization/security",
          TRACKING_GROUP,
        ),
      ).toBe(false);
      expect(
        isNavLinkActive(
          "/organisations/1/settings/tracking/timesheets",
          MEMBERS_GROUP,
        ),
      ).toBe(false);
    });

    it("is not active on the settings index", () => {
      expect(isNavLinkActive("/organisations/1/settings", TRACKING_GROUP)).toBe(
        false,
      );
    });
  });
});
