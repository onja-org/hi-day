import { afterEach, describe, expect, it, vi } from "vitest";
import { addTeamMember } from "@/lib/addTeamMember";

describe("addTeamMember", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const result = await addTeamMember("org-1", "team-1", {
      membershipId: "m-1",
    });

    expect(result).toEqual({ ok: true });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Membership not found." }),
      }),
    );

    const result = await addTeamMember("org-1", "team-1", {
      membershipId: "m-1",
      isManager: true,
    });

    expect(result).toEqual({ ok: false, message: "Membership not found." });
  });

  it("returns a generic error message when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    const result = await addTeamMember("org-1", "team-1", {
      membershipId: "m-1",
    });

    expect(result).toEqual({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
