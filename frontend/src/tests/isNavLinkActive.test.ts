import { describe, expect, it } from "vitest";
import { isNavLinkActive } from "@/lib/isNavLinkActive";

describe("isNavLinkActive", () => {
  it("is active on the link's own page", () => {
    expect(isNavLinkActive("/organisations/1/teams", "/organisations/1/teams")).toBe(true);
  });

  it("is active on a page nested under the link", () => {
    expect(isNavLinkActive("/organisations/1/teams/abc", "/organisations/1/teams")).toBe(true);
  });

  it("is not active on a sibling whose path merely shares a prefix", () => {
    expect(isNavLinkActive("/organisations/1/teamsx", "/organisations/1/teams")).toBe(false);
  });

  it("is not active on an unrelated page", () => {
    expect(isNavLinkActive("/organisations/1/projects", "/organisations/1/teams")).toBe(false);
  });
});
