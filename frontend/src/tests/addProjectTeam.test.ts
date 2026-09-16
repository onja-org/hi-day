import { afterEach, describe, expect, it, vi } from "vitest";
import { addProjectTeam } from "@/lib/addProjectTeam";

describe("addProjectTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the assigned team on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ id: "pt-1", teamId: "team-1", name: "Engineering" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await addProjectTeam("org-1", "p-1", { teamId: "team-1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.team.name).toBe("Engineering");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/teams",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ teamId: "team-1" }),
      }),
    );
  });

  it("surfaces a conflict error when the team is already assigned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This team is already on the project." }),
      }),
    );

    const result = await addProjectTeam("org-1", "p-1", { teamId: "team-1" });

    expect(result).toEqual({
      ok: false,
      message: "This team is already on the project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await addProjectTeam("org-1", "p-1", { teamId: "team-1" });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
