import { afterEach, describe, expect, it, vi } from "vitest";
import { setTeamActivityVisibility } from "@/lib/setTeamActivityVisibility";

describe("setTeamActivityVisibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns how many members were actually updated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Updated 3 members", updated: 3 }),
      }),
    );

    const result = await setTeamActivityVisibility("org-1", "team-1", false);

    expect(result).toEqual({
      ok: true,
      message: "Updated 3 members",
      updated: 3,
    });
  });

  it("posts the chosen value to the team's endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Updated 1 member", updated: 1 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await setTeamActivityVisibility("org-1", "team-1", false);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(
      "/organisations/org-1/teams/team-1/members/activity-visibility",
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ canViewOwnActivity: false });
  });

  it("sends null to clear the overrides rather than omitting the field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Updated 2 members", updated: 2 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await setTeamActivityVisibility("org-1", "team-1", null);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      canViewOwnActivity: null,
    });
  });

  it("surfaces the backend's refusal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "Only an admin or this team's manager can change its members.",
          }),
      }),
    );

    const result = await setTeamActivityVisibility("org-1", "team-1", false);

    expect(result).toEqual({
      ok: false,
      message: "Only an admin or this team's manager can change its members.",
    });
  });

  it("returns a generic message when the request never lands", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await setTeamActivityVisibility("org-1", "team-1", true);

    expect(result.ok).toBe(false);
  });
});
