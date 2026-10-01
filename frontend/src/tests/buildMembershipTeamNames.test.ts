import { describe, expect, it } from "vitest";
import { buildMembershipTeamNames } from "@/lib/buildMembershipTeamNames";

describe("buildMembershipTeamNames", () => {
  const teams = [
    { id: "t1", name: "Dev" },
    { id: "t2", name: "Design" },
  ];

  it("maps each membership to its team names", () => {
    const result = buildMembershipTeamNames([{ id: "m1", teamIds: ["t1", "t2"] }], teams);
    expect(result.get("m1")).toEqual(["Dev", "Design"]);
  });

  it("gives a member with no teams an empty list", () => {
    expect(buildMembershipTeamNames([{ id: "m1", teamIds: [] }], teams).get("m1")).toEqual([]);
  });

  it("skips team ids that aren't in the teams list", () => {
    const result = buildMembershipTeamNames([{ id: "m1", teamIds: ["gone", "t1"] }], teams);
    expect(result.get("m1")).toEqual(["Dev"]);
  });
});
