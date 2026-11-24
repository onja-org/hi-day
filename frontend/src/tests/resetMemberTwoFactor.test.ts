import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMemberTwoFactor } from "@/lib/resetMemberTwoFactor";

describe("resetMemberTwoFactor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the member's reset route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ member: {}, message: "Two-step login reset." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await resetMemberTwoFactor("org-1", "m-1")).toEqual({
      ok: true,
      message: "Two-step login reset.",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/organisations/org-1/memberships/m-1/two-factor-reset",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the backend's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Two-step login is already off for them." }),
      }),
    );

    expect(await resetMemberTwoFactor("org-1", "m-1")).toEqual({
      ok: false,
      message: "Two-step login is already off for them.",
    });
  });

  it("returns a generic error when the request can't be made", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await resetMemberTwoFactor("org-1", "m-1")).ok).toBe(false);
  });
});
