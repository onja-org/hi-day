import { describe, expect, it } from "vitest";
import { logTimeForCandidates } from "@/lib/logTimeForCandidates";
import type { ProjectMember } from "@/types/project";

const member = (membershipId: string, userId: string, role: ProjectMember["role"]): ProjectMember => ({
  id: `pm-${membershipId}`,
  membershipId,
  userId,
  email: `${userId}@example.com`,
  name: null,
  role,
});

const projectMembers = [
  member("m-me", "u-me", "member"),
  member("m-a", "u-a", "member"),
  member("m-b", "u-b", "member"),
  member("m-v", "u-v", "viewer"),
];

describe("logTimeForCandidates", () => {
  it("offers an admin everyone on the project except viewers and themselves", () => {
    const ids = logTimeForCandidates(projectMembers, { userId: "u-me", role: "admin" }, null).map((m) => m.membershipId);
    expect(ids).toEqual(["m-a", "m-b"]);
  });

  it("offers a project manager everyone on their project, whatever their org role", () => {
    const withManager = [member("m-me", "u-me", "manager"), ...projectMembers.slice(1)];
    const ids = logTimeForCandidates(withManager, { userId: "u-me", role: "member" }, null).map((m) => m.membershipId);
    expect(ids).toEqual(["m-a", "m-b"]);
  });

  it("limits an org manager to the people they can see", () => {
    const ids = logTimeForCandidates(projectMembers, { userId: "u-me", role: "manager" }, new Set(["m-a"])).map((m) => m.membershipId);
    expect(ids).toEqual(["m-a"]);
  });

  it("offers an org manager nobody until their visible members have loaded", () => {
    expect(logTimeForCandidates(projectMembers, { userId: "u-me", role: "manager" }, null)).toEqual([]);
  });
});
