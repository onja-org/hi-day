import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMembersTwoFactor } from "@/lib/resetMembersTwoFactor";

describe("resetMembersTwoFactor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the membership ids and returns per-member results", async () => {
    const results = [
      { membershipId: "m-1", email: "a@x.com", outcome: "reset" },
      { membershipId: "m-2", email: "b@x.com", outcome: "skipped", message: "Already off." },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results, message: "Two-step login reset for 1 member; 1 skipped" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resetMembersTwoFactor("org-1", ["m-1", "m-2"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/memberships/two-factor-resets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ membershipIds: ["m-1", "m-2"] }),
      }),
    );
    expect(result).toEqual({
      ok: true,
      results,
      message: "Two-step login reset for 1 member; 1 skipped",
    });
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Forbidden resource" }),
      }),
    );

    expect(await resetMembersTwoFactor("org-1", ["m-1"])).toEqual({
      ok: false,
      message: "Forbidden resource",
    });
  });

  it("returns a generic error when the request can't be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect((await resetMembersTwoFactor("org-1", ["m-1"])).ok).toBe(false);
  });
});
