import { describe, expect, it } from "vitest";
import { allowedAppsNotice } from "@/lib/allowedAppsNotice";

describe("allowedAppsNotice", () => {
  it("says nothing when the web timer is allowed", () => {
    expect(allowedAppsNotice("all")).toBeNull();
  });

  it("names the client to use when the web timer is not", () => {
    expect(allowedAppsNotice("desktop_only")).toContain("desktop app");
    expect(allowedAppsNotice("mobile_only")).toContain("mobile app");
  });
});
