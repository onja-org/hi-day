import { describe, expect, it } from "vitest";
import { buildMembershipTeamIds, buildMembershipTeamNames } from "@/lib/buildMembershipTeamNames";

const member = (membershipId: string) => ({
  membershipId,
  userId: `u-${membershipId}`,
  name: null,
  email: `${membershipId}@example.com`,
  isManager: false,
});

const teams = [
  { id: "t1", name: "Dev", members: [member("m1"), member("m2")] },
  { id: "t2", name: "Design", members: [member("m1")] },
];

describe("buildMembershipTeamNames", () => {
  it("lists every team a membership is on, in team order", () => {
    expect(buildMembershipTeamNames(teams).get("m1")).toEqual(["Dev", "Design"]);
  });

  it("lists a single team for a member on one", () => {
    expect(buildMembershipTeamNames(teams).get("m2")).toEqual(["Dev"]);
  });

  it("has no entry for someone on no visible team", () => {
    expect(buildMembershipTeamNames(teams).get("m3")).toBeUndefined();
  });
});

describe("buildMembershipTeamIds", () => {
  it("maps a membership to its team ids", () => {
    expect(buildMembershipTeamIds(teams).get("m1")).toEqual(["t1", "t2"]);
  });
});
