import { afterEach, describe, expect, it, vi } from "vitest";
import { getAssignableProjectTeams } from "@/lib/getAssignableProjectTeams";

describe("getAssignableProjectTeams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the assignable team list on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "team-1", name: "Engineering" }]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getAssignableProjectTeams("org-1", "p-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teams).toHaveLength(1);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/projects/p-1/assignable-teams",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "You do not have the required role for this project.",
          }),
      }),
    );

    const result = await getAssignableProjectTeams("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "You do not have the required role for this project.",
    });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getAssignableProjectTeams("org-1", "p-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
