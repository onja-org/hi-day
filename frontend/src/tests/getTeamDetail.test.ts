import { afterEach, describe, expect, it, vi } from "vitest";
import { getTeamDetail } from "@/lib/getTeamDetail";

describe("getTeamDetail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the team detail on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "team-1",
            name: "Engineering",
            members: [
              {
                membershipId: "m-1",
                userId: "user-1",
                name: "A B",
                email: "a@b.test",
                isManager: true,
              },
            ],
          }),
      }),
    );

    const result = await getTeamDetail("org-1", "team-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.team.members).toHaveLength(1);
    }
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Team not found." }),
      }),
    );

    const result = await getTeamDetail("org-1", "team-1");

    expect(result).toEqual({ ok: false, message: "Team not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await getTeamDetail("org-1", "team-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
