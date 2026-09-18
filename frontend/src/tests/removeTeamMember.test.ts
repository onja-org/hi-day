import { afterEach, describe, expect, it, vi } from "vitest";
import { removeTeamMember } from "@/lib/removeTeamMember";

describe("removeTeamMember", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: "Team member removed" }),
      }),
    );

    const result = await removeTeamMember("org-1", "team-1", "m-1");

    expect(result).toEqual({ ok: true, message: "Team member removed" });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Team not found." }),
      }),
    );

    const result = await removeTeamMember("org-1", "team-1", "m-1");

    expect(result).toEqual({ ok: false, message: "Team not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await removeTeamMember("org-1", "team-1", "m-1");

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
