import { describe, expect, it } from "vitest";
import {
  activeSettingsLocation,
  settingsHref,
  SETTINGS_GROUPS,
  visibleSettingsGroups,
} from "@/lib/settingsNavigation";

const ORG = "org-1";

describe("SETTINGS_GROUPS", () => {
  it("holds the groups in card order", () => {
    expect(SETTINGS_GROUPS.map((group) => group.key)).toEqual([
      "organization",
      "members",
      "projects",
      "billing",
      "tracking",
    ]);
  });
});

/** One filter for the sidebar, the cards and the section header. */
describe("visibleSettingsGroups", () => {
  it("keeps every group, in card order, where billing is on", () => {
    expect(visibleSettingsGroups(true).map((group) => group.key)).toEqual([
      "organization",
      "members",
      "projects",
      "billing",
      "tracking",
    ]);
  });

  it("drops only Billing where billing is off", () => {
    expect(visibleSettingsGroups(false).map((group) => group.key)).toEqual([
      "organization",
      "members",
      "projects",
      "tracking",
    ]);
  });

  it("leaves the full list untouched", () => {
    visibleSettingsGroups(false);

    expect(SETTINGS_GROUPS.map((group) => group.key)).toContain("billing");
  });
});

describe("SETTINGS_GROUPS shape", () => {

  it("has no duplicate section keys within a group", () => {
    for (const group of SETTINGS_GROUPS) {
      const keys = group.sections.map((section) => section.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("settingsHref", () => {
  it("points at a group's section", () => {
    expect(settingsHref(ORG, "tracking", "screenshots")).toBe(
      "/organisations/org-1/settings/tracking/screenshots",
    );
  });
});

describe("activeSettingsLocation", () => {
  it("reads the group and section from a settings path", () => {
    expect(
      activeSettingsLocation("/organisations/org-1/settings/tracking/time", true),
    ).toEqual({ groupKey: "tracking", sectionKey: "time" });
  });

  it("ignores anything after the section", () => {
    expect(
      activeSettingsLocation(
        "/organisations/org-1/settings/tracking/time/extra",
        true,
      ),
    ).toEqual({ groupKey: "tracking", sectionKey: "time" });
  });

  // An unknown segment must not light up a tab that is not showing.
  it("is null for a group or section that does not exist", () => {
    expect(
      activeSettingsLocation("/organisations/org-1/settings/nope/time", true),
    ).toBeNull();
    expect(
      activeSettingsLocation("/organisations/org-1/settings/tracking/nope", true),
    ).toBeNull();
  });

  /** A billing path is not a settings section when billing is off. */
  it("resolves a billing path only where billing is on", () => {
    const path = "/organisations/org-1/settings/billing/subscription";

    expect(activeSettingsLocation(path, true)).toEqual({
      groupKey: "billing",
      sectionKey: "subscription",
    });
    expect(activeSettingsLocation(path, false)).toBeNull();
  });

  it("is null away from settings", () => {
    expect(
      activeSettingsLocation("/organisations/org-1/members", true),
    ).toBeNull();
    expect(
      activeSettingsLocation("/organisations/org-1/settings", true),
    ).toBeNull();
  });
});
