import { describe, expect, it } from "vitest";
import {
  activeSettingsLocation,
  settingsHref,
  SETTINGS_GROUPS,
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
      activeSettingsLocation("/organisations/org-1/settings/tracking/time"),
    ).toEqual({ groupKey: "tracking", sectionKey: "time" });
  });

  it("ignores anything after the section", () => {
    expect(
      activeSettingsLocation("/organisations/org-1/settings/tracking/time/extra"),
    ).toEqual({ groupKey: "tracking", sectionKey: "time" });
  });

  // An unknown segment must not light up a tab that is not showing.
  it("is null for a group or section that does not exist", () => {
    expect(
      activeSettingsLocation("/organisations/org-1/settings/nope/time"),
    ).toBeNull();
    expect(
      activeSettingsLocation("/organisations/org-1/settings/tracking/nope"),
    ).toBeNull();
  });

  it("is null away from settings", () => {
    expect(activeSettingsLocation("/organisations/org-1/members")).toBeNull();
    expect(activeSettingsLocation("/organisations/org-1/settings")).toBeNull();
  });
});
