import { describe, expect, it } from "vitest";
import { canDeleteShownScreenshots } from "@/lib/canDeleteShownScreenshots";

describe("canDeleteShownScreenshots", () => {
  it("offers nothing to a member the organisation has not allowed", () => {
    expect(
      canDeleteShownScreenshots({
        role: "member",
        canDeleteOwnScreenshots: false,
        viewedMembershipId: undefined,
      }),
    ).toBe(false);
  });

  it("offers a member their own gallery once allowed", () => {
    expect(
      canDeleteShownScreenshots({
        role: "member",
        canDeleteOwnScreenshots: true,
        viewedMembershipId: undefined,
      }),
    ).toBe(true);
  });

  it("offers a manager nothing on someone else's gallery, allowed or not", () => {
    expect(
      canDeleteShownScreenshots({
        role: "manager",
        canDeleteOwnScreenshots: true,
        viewedMembershipId: "membership-other",
      }),
    ).toBe(false);
  });

  it("offers an admin every gallery, since they may delete anyone's", () => {
    expect(
      canDeleteShownScreenshots({
        role: "admin",
        canDeleteOwnScreenshots: true,
        viewedMembershipId: "membership-other",
      }),
    ).toBe(true);
  });

  it("offers nothing while the profile is still loading", () => {
    expect(
      canDeleteShownScreenshots({
        role: undefined,
        canDeleteOwnScreenshots: false,
        viewedMembershipId: undefined,
      }),
    ).toBe(false);
  });
});
