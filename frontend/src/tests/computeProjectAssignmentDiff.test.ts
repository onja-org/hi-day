import { describe, expect, it } from "vitest";
import { computeProjectAssignmentDiff } from "@/lib/computeProjectAssignmentDiff";
import type { ProjectMember, ProjectTeamMember } from "@/types/project";

function makeMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: "pm-1",
    membershipId: "m-1",
    userId: "u-1",
    email: "a@example.com",
    name: "A",
    role: "member",
    ...overrides,
  };
}

function makeTeam(overrides: Partial<ProjectTeamMember> = {}): ProjectTeamMember {
  return {
    id: "pt-1",
    teamId: "t-1",
    name: "Team 1",
    ...overrides,
  };
}

describe("computeProjectAssignmentDiff", () => {
  it("adds newly-checked members and teams not already assigned", () => {
    const diff = computeProjectAssignmentDiff(
      [],
      new Map([["m-1", "member"]]),
      [],
      new Set(["t-1"]),
    );

    expect(diff.membersToAdd).toEqual([{ membershipId: "m-1", role: "member" }]);
    expect(diff.teamIdsToAdd).toEqual(["t-1"]);
    expect(diff.membershipIdsToRemove).toEqual([]);
    expect(diff.teamIdsToRemove).toEqual([]);
    expect(diff.membersToUpdateRole).toEqual([]);
  });

  it("removes members and teams that were unchecked", () => {
    const diff = computeProjectAssignmentDiff(
      [makeMember({ membershipId: "m-1" })],
      new Map(),
      [makeTeam({ teamId: "t-1" })],
      new Set(),
    );

    expect(diff.membershipIdsToRemove).toEqual(["m-1"]);
    expect(diff.teamIdsToRemove).toEqual(["t-1"]);
    expect(diff.membersToAdd).toEqual([]);
    expect(diff.teamIdsToAdd).toEqual([]);
  });

  it("reports a role change for a member who stays checked but changes role", () => {
    const diff = computeProjectAssignmentDiff(
      [makeMember({ membershipId: "m-1", role: "member" })],
      new Map([["m-1", "manager"]]),
      [],
      new Set(),
    );

    expect(diff.membersToUpdateRole).toEqual([{ membershipId: "m-1", role: "manager" }]);
    expect(diff.membersToAdd).toEqual([]);
    expect(diff.membershipIdsToRemove).toEqual([]);
  });

  it("reports nothing when the selection matches the current assignments exactly", () => {
    const diff = computeProjectAssignmentDiff(
      [makeMember({ membershipId: "m-1", role: "member" })],
      new Map([["m-1", "member"]]),
      [makeTeam({ teamId: "t-1" })],
      new Set(["t-1"]),
    );

    expect(diff).toEqual({
      membersToAdd: [],
      membershipIdsToRemove: [],
      membersToUpdateRole: [],
      teamIdsToAdd: [],
      teamIdsToRemove: [],
    });
  });
});
