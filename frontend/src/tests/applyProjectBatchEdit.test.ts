import { afterEach, describe, expect, it, vi } from "vitest";
import { applyProjectBatchEdit } from "@/lib/applyProjectBatchEdit";
import type { ProjectOverviewItem } from "@/types/project";

const project: ProjectOverviewItem = {
  id: "p-1",
  name: "Website",
  description: null,
  colour: "blue",
  status: "active",
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  taskCount: 0,
  teams: [{ id: "pt-1", teamId: "t-design", name: "Design" }],
  members: [
    {
      id: "pm-1",
      membershipId: "m-ada",
      userId: "u-ada",
      email: "ada@example.com",
      name: "Ada",
      role: "member",
    },
  ],
};

function okResponse() {
  return { ok: true, json: () => Promise.resolve({ message: "ok" }) };
}

describe("applyProjectBatchEdit", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets the colour and adds only the teams and members not already on the project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyProjectBatchEdit("org-1", project, {
      colour: "green",
      teamIds: ["t-design", "t-sales"],
      memberIds: ["m-ada", "m-bob"],
      memberRole: "manager",
    });

    expect(result).toEqual({ ok: true, message: "Updated" });
    const calls = fetchMock.mock.calls.map((call) => {
      const [url, init] = call as [string, RequestInit];
      return [url, init.method, init.body];
    });
    expect(calls).toEqual([
      [
        "/api/backend/organisations/org-1/projects/p-1",
        "PATCH",
        JSON.stringify({ colour: "green" }),
      ],
      [
        "/api/backend/organisations/org-1/projects/p-1/teams",
        "POST",
        JSON.stringify({ teamId: "t-sales" }),
      ],
      [
        "/api/backend/organisations/org-1/projects/p-1/members",
        "POST",
        JSON.stringify({ membershipId: "m-bob", role: "manager" }),
      ],
    ]);
  });

  it("sends nothing when everything is already in place", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyProjectBatchEdit("org-1", project, {
      colour: "blue",
      teamIds: ["t-design"],
      memberIds: ["m-ada"],
      memberRole: "member",
    });

    expect(result).toEqual({ ok: true, message: "Already up to date" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps going after a failed request and reports the first failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: "Team not found." }),
      })
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyProjectBatchEdit("org-1", project, {
      teamIds: ["t-gone"],
      memberIds: ["m-bob"],
      memberRole: "member",
    });

    expect(result).toEqual({ ok: false, message: "Team not found." });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
