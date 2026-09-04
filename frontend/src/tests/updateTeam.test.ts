import { afterEach, describe, expect, it, vi } from "vitest";
import { updateTeam } from "@/lib/updateTeam";

describe("updateTeam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok with the renamed team on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "team-1", name: "New Name" }),
      }),
    );

    const result = await updateTeam("org-1", "team-1", "New Name");

    expect(result).toEqual({
      ok: true,
      team: { id: "team-1", name: "New Name" },
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Team not found." }),
      }),
    );

    const result = await updateTeam("org-1", "team-1", "New Name");

    expect(result).toEqual({ ok: false, message: "Team not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await updateTeam("org-1", "team-1", "New Name");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
