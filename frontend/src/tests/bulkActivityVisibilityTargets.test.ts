import { describe, expect, it } from "vitest";
import { bulkActivityVisibilityTargets } from "@/lib/bulkActivityVisibilityTargets";
import type { TeamMember } from "@/types/team";

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: "m-1",
    userId: "user-1",
    name: "Ada",
    email: "ada@example.com",
    isManager: false,
    role: "member",
    canViewOwnActivity: null,
    ...overrides,
  } as TeamMember;
}

const ids = (members: TeamMember[]) => members.map((m) => m.membershipId);

describe("bulkActivityVisibilityTargets", () => {
  it("includes the team's plain members", () => {
    const members = [
      member({ membershipId: "m-1", userId: "u-1" }),
      member({ membershipId: "m-2", userId: "u-2" }),
    ];

    expect(ids(bulkActivityVisibilityTargets(members, "u-9"))).toEqual([
      "m-1",
      "m-2",
    ]);
  });

  it("leaves out an admin — the setting does nothing for them", () => {
    const members = [
      member({ membershipId: "m-1", userId: "u-1" }),
      member({ membershipId: "m-2", userId: "u-2", role: "admin" }),
    ];

    expect(ids(bulkActivityVisibilityTargets(members, "u-9"))).toEqual(["m-1"]);
  });

  it("leaves out this team's managers for the same reason", () => {
    const members = [
      member({ membershipId: "m-1", userId: "u-1" }),
      member({ membershipId: "m-2", userId: "u-2", isManager: true }),
    ];

    expect(ids(bulkActivityVisibilityTargets(members, "u-9"))).toEqual(["m-1"]);
  });

  it("never includes the viewer, so applying to everyone cannot hide their own", () => {
    const members = [
      member({ membershipId: "m-1", userId: "u-1" }),
      member({ membershipId: "m-2", userId: "u-2" }),
    ];

    expect(ids(bulkActivityVisibilityTargets(members, "u-2"))).toEqual(["m-1"]);
  });

  it("returns nothing when every member is excluded", () => {
    const members = [
      member({ membershipId: "m-1", userId: "u-1", role: "admin" }),
      member({ membershipId: "m-2", userId: "u-2", isManager: true }),
    ];

    expect(bulkActivityVisibilityTargets(members, "u-9")).toEqual([]);
  });

  it("handles an unknown viewer without dropping anyone", () => {
    const members = [member({ membershipId: "m-1", userId: "u-1" })];

    expect(ids(bulkActivityVisibilityTargets(members, undefined))).toEqual([
      "m-1",
    ]);
  });
});
