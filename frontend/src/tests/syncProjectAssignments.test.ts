import { afterEach, describe, expect, it, vi } from "vitest";
import { syncProjectAssignments } from "@/lib/syncProjectAssignments";
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

describe("syncProjectAssignments", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("issues no requests when the selection already matches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProjectAssignments(
      "org-1",
      "p-1",
      [makeMember({ membershipId: "m-1" })],
      new Map([["m-1", "member"]]),
      [makeTeam({ teamId: "t-1" })],
      new Set(["t-1"]),
    );

    expect(result).toEqual({ ok: true, failures: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds, removes, and role-updates members, and adds/removes teams", async () => {
    const calls: { method: string; url: string }[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      calls.push({ method: init.method as string, url });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncProjectAssignments(
      "org-1",
      "p-1",
      [
        makeMember({ membershipId: "m-1", role: "member" }),
        makeMember({ membershipId: "m-2", role: "member" }),
      ],
      new Map([
        ["m-1", "manager"], // role change
        ["m-3", "member"], // new add
      ]),
      [makeTeam({ teamId: "t-1" })],
      new Set(["t-2"]),
    );

    expect(result).toEqual({ ok: true, failures: [] });

    expect(calls).toContainEqual({
      method: "POST",
      url: "/api/backend/organisations/org-1/projects/p-1/members",
    });
    expect(calls).toContainEqual({
      method: "DELETE",
      url: "/api/backend/organisations/org-1/projects/p-1/members/m-2",
    });
    expect(calls).toContainEqual({
      method: "PATCH",
      url: "/api/backend/organisations/org-1/projects/p-1/members/m-1",
    });
    expect(calls).toContainEqual({
      method: "POST",
      url: "/api/backend/organisations/org-1/projects/p-1/teams",
    });
    expect(calls).toContainEqual({
      method: "DELETE",
      url: "/api/backend/organisations/org-1/projects/p-1/teams/t-1",
    });
  });

  it("collects a readable failure per failed request instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Nope" }),
      }),
    );

    const result = await syncProjectAssignments(
      "org-1",
      "p-1",
      [makeMember({ membershipId: "m-1" })],
      new Map(),
      [],
      new Set(),
    );

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual(["Couldn't remove member: Nope"]);
  });
});
