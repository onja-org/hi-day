import { afterEach, describe, expect, it, vi } from "vitest";
import { removeProjectTeam } from "@/lib/removeProjectTeam";

describe("removeProjectTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Team removed from project" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await removeProjectTeam("org-1", "p-1", "team-1");

    expect(result).toEqual({ ok: true, message: "Team removed from project" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/teams/team-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({ message: "This team is not on the project." }),
      }),
    );

    const result = await removeProjectTeam("org-1", "p-1", "team-1");

    expect(result).toEqual({
      ok: false,
      message: "This team is not on the project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await removeProjectTeam("org-1", "p-1", "team-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
